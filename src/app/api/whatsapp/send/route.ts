import { PróximoResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage, sendModeloMessage } from '@/lib/whatsapp/meta-api'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  sanitizeTelefoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotTodosowedErro,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import type { MessageModelo } from '@/types'
import { isMessageModelo } from '@/lib/whatsapp/template-row-guard'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authErro,
    } = await supabase.auth.getUser()

    if (authErro || !user) {
      return PróximoResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${user.id}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    // Resolver the caller's account_id. Every downstream lookup
    // (conversation, whatsapp_config, message_templates) is account-
    // scoped post-multi-user, so the previous `user_id` filters
    // returned nothing for teammates who didn't author the row.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return PróximoResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const {
      conversation_id,
      message_type,
      content_text,
      media_url,
      template_name,
      template_language,
      template_params,
      template_message_params,
      reply_to_message_id,
    } = body

    if (!conversation_id || !message_type) {
      return PróximoResponse.json(
        { error: 'conversation_id and message_type are required' },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return PróximoResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return PróximoResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    // Fetch conversation and contact
    const { data: conversation, error: convErro } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('account_id', accountId)
      .single()

    if (convErro || !conversation) {
      return PróximoResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = conversation.contact
    if (!contact?.phone) {
      return PróximoResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      )
    }

    // Sanitize and validate phone
    const sanitizedTelefone = sanitizeTelefoneForMeta(contact.phone)
    if (!isValidE164(sanitizedTelefone)) {
      return PróximoResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configErro } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (configErro || !config) {
      return PróximoResponse.json(
        { error: 'WhatsApp not configured. Please set up your WhatsApp integration first.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Self-heal legacy CBC-encrypted tokens. Fire-and-forget: we
    // return from the send without waiting, so a failed upgrade just
    // means the next send tries again. The upgrade is idempotent —
    // concurrent sends both produce valid GCM ciphertexts of the same
    // plaintext, last write wins.
    if (isLegacyFormat(config.access_token)) {
      void supabase
        .from('whatsapp_config')
        .update({ access_token: encrypt(accessToken) })
        .eq('id', config.id)
        .then(({ error }) => {
          if (error) {
            console.warn(
              '[whatsapp/send] access_token GCM upgrade failed:',
              error.message,
            )
          }
        })
    }

    // Resolver the reply target (if any) to its Meta message_id, which is
    // what `context.message_id` on the outgoing Meta payload needs. The
    // parent must belong to this same conversation — otherwise a caller
    // could quote messages they can't see by guessing UUIDs.
    let contextMessageId: string | undefined
    if (reply_to_message_id) {
      const { data: parent, error: parentErro } = await supabase
        .from('messages')
        .select('message_id, conversation_id')
        .eq('id', reply_to_message_id)
        .eq('conversation_id', conversation_id)
        .maybeSingle()

      if (parentErro || !parent) {
        return PróximoResponse.json(
          { error: 'reply_to_message_id not found in this conversation' },
          { status: 400 }
        )
      }
      if (!parent.message_id) {
        // Parent never reached Meta (still in 'sending' or 'failed') — we
        // can't quote it on WhatsApp. Enviar without context rather than
        // dropping the message entirely.
        console.warn(
          '[whatsapp/send] reply target has no Meta message_id; sending without context'
        )
      } else {
        contextMessageId = parent.message_id
      }
    }

    // Enviar via Meta API — retry with phone-number variants if Meta rejects
    // with "recipient not in allowed list" (common in sandbox / when a
    // number was registered with/without a trunk 0). If an alternate
    // format succeeds, we persist it back to the contact row so the
    // next send goes through on the first attempt.
    let waMessageId = ''
    let workingTelefone = sanitizedTelefone

    // For template sends, load the row so sendModeloMessage can
    // build header + button components from the template definition.
    // Match on (user_id, name, language) — same triple the unique
    // index enforces — so multi-language templates work correctly.
    // Missing template falls through with `templateRow = null` and
    // the legacy body-only path runs.
    // Load the template row so sendModeloMessage can build header
    // + button components from the definition. isMessageModelo
    // guards against a malformed row (e.g. from a partial sync)
    // crashing the send-builder later in the stack.
    let templateRow: MessageModelo | null = null
    if (message_type === 'template' && template_name) {
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('account_id', accountId)
        .eq('name', template_name)
        .eq('language', template_language || 'en_US')
        .maybeSingle()
      if (data && !isMessageModelo(data)) {
        return PróximoResponse.json(
          {
            error:
              'Modelo row is malformed locally — run "Sync from Meta" in Settings to repair it.',
          },
          { status: 500 },
        )
      }
      templateRow = data ?? null
    }

    const attempt = async (phone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await sendModeloMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          templateNome: template_name,
          language: template_language || 'en_US',
          template: templateRow ?? undefined,
          messageParams: template_message_params ?? undefined,
          // Legacy body-only fallback — only consulted when
          // messageParams.body isn't set.
          params: template_params || [],
          contextMessageId,
        })
        return result.messageId
      }
      const result = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        text: content_text,
        contextMessageId,
      })
      return result.messageId
    }

    try {
      const variants = phoneVariants(sanitizedTelefone)
      let lastErro: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingTelefone = variant
          lastErro = null
          break
        } catch (err) {
          const message = err instanceof Erro ? err.message : String(err)
          // Only retry when the failure is specifically that the
          // recipient isn't in Meta's allowed list. Any other error
          // (bad token, invalid template, etc.) bubbles up immediately.
          if (!isRecipientNotTodosowedErro(message)) {
            throw err
          }
          lastErro = err
          console.warn(`[whatsapp/send] variant "${variant}" rejected by Meta, trying next…`)
        }
      }

      if (lastErro) throw lastErro
    } catch (err) {
      const message = err instanceof Erro ? err.message : 'Unknown Meta API error'
      console.error('Meta API send failed for all variants:', message)
      return PróximoResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 }
      )
    }

    // If a non-original variant succeeded, update the contact so future
    // sends go straight through. sanitizeTelefoneForMeta on workingTelefone
    // will yield workingTelefone itself, so re-storing preserves it.
    if (workingTelefone !== sanitizedTelefone) {
      console.log(
        `[whatsapp/send] Auto-corrected contact phone: ${sanitizedTelefone} → ${workingTelefone}`
      )
      await supabase
        .from('contacts')
        .update({ phone: workingTelefone })
        .eq('id', contact.id)
    }

    // Insert message into DB — field names MUST match the messages schema
    // (see supabase/migrations/001_initial_schema.sql):
    //   conversation_id, sender_type, content_type, content_text,
    //   media_url, template_name, message_id, status, created_at
    const { data: messageRecord, error: msgErro } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: message_type,
        content_text: content_text || null,
        media_url: media_url || null,
        template_name: template_name || null,
        message_id: waMessageId,
        status: 'sent',
        reply_to_message_id: reply_to_message_id || null,
      })
      .select()
      .single()

    if (msgErro) {
      console.error('Erro inserting sent message:', msgErro)
      return PróximoResponse.json(
        { error: `Message sent to Meta but failed to save to DB: ${msgErro.message}` },
        { status: 500 }
      )
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id)

    // Pause any active Flow run for this contact — the agent stepping
    // in is the strongest "yield, human is here" signal. See PR #2
    // plan for why we pause (not end): preserves diagnostic state +
    // lets the agent or the 24h timeout sweep cleanly resolve the
    // run later. For accounts with no active runs the UPDATE matches
    // zero rows — cheap and harmless.
    try {
      const { error: pauseErr } = await supabaseAdmin()
        .from('flow_runs')
        .update({
          status: 'paused_by_agent',
          ended_at: new Date().toISOString(),
          end_reason: 'agent_replied',
        })
        .eq('account_id', accountId)
        .eq('contact_id', contact.id)
        .eq('status', 'active')
      if (pauseErr) {
        // Best-effort — log + continue. The agent's message already
        // landed at Meta; don't fail the response over a bookkeeping
        // miss. Worst case: a stale active run gets caught by the
        // stale-run cron sweep within 24h.
        console.error('[flows] pause-on-agent-send failed:', pauseErr.message)
      }
    } catch (err) {
      console.error(
        '[flows] pause-on-agent-send threw:',
        err instanceof Erro ? err.message : err,
      )
    }

    return PróximoResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })
  } catch (error) {
    console.error('Erro in WhatsApp send POST:', error)
    return PróximoResponse.json(
      { error: 'Falhou to send message' },
      { status: 500 }
    )
  }
}
