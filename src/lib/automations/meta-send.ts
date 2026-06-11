import { sendTextMessage, sendModeloMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizeTelefoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotTodosowedErro,
} from '@/lib/whatsapp/phone-utils'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// Automation-side Meta sender.
//
// Mirrors the logic in src/app/api/whatsapp/send/route.ts but uses
// the service-role client (engine has no cookies) and accepts the
// user / conversation / contact identifiers the engine already has
// on hand. Kept here (rather than refactoring the user-facing send
// route) to avoid risk to the working manual-send path — they can
// converge in a later refactor.
// ------------------------------------------------------------

interface EnviarTextArgs {
  /** Account-level tenancy key. Drives contact + whatsapp_config
   *  lookups so an automation authored by user A still sends through
   *  the WhatsApp number user B saved on the same account. */
  accountId: string
  /** Original author of the automation/flow — used for INSERT audit
   *  columns (messages.sender_id-ish) and for resolving the agent's
   *  identity in logs. Not consulted for tenancy. */
  userId: string
  conversationId: string
  contactId: string
  text: string
}

interface EnviarModeloArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  templateNome: string
  language?: string
  params?: string[]
}

export async function engineEnviarText(args: EnviarTextArgs): Promise<{ whatsapp_message_id: string }> {
  return sendViaMeta({ ...args, kind: 'text' })
}

export async function engineEnviarModelo(
  args: EnviarModeloArgs,
): Promise<{ whatsapp_message_id: string }> {
  return sendViaMeta({ ...args, kind: 'template' })
}

type EnviarInput =
  | (EnviarTextArgs & { kind: 'text' })
  | (EnviarModeloArgs & { kind: 'template' })

async function sendViaMeta(input: EnviarInput): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()

  // Scope the contact + config lookups by account_id, not user_id.
  // The engine uses the service-role client (bypassing RLS); without
  // this filter, an authenticated user could fire their own
  // automations against another tenant's contact UUID and send via
  // their own WhatsApp config to that contact's phone. The 017
  // migration moved both tables to account-scoped tenancy, so the
  // check is the same defense-in-depth as before, just keyed on the
  // new tenancy column.
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', input.contactId)
    .eq('account_id', input.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Erro('contact not found for this account')
  }

  const sanitized = sanitizeTelefoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Erro(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', input.accountId)
    .single()
  if (configErr || !config) {
    throw new Erro('WhatsApp not configured for this account')
  }

  const accessToken = decrypt(config.access_token)

  const attempt = async (phone: string): Promise<string> => {
    if (input.kind === 'template') {
      const r = await sendModeloMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        templateNome: input.templateNome,
        language: input.language,
        params: input.params,
      })
      return r.messageId
    }
    const r = await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: phone,
      text: input.text,
    })
    return r.messageId
  }

  // Same phone-variant retry as /api/whatsapp/send — Meta sandbox and
  // numbers registered with/without a trunk 0 both require this to
  // reliably land a message.
  const variants = phoneVariants(sanitized)
  let workingTelefone = sanitized
  let waMessageId = ''
  let lastErro: unknown = null
  for (const v of variants) {
    try {
      waMessageId = await attempt(v)
      workingTelefone = v
      lastErro = null
      break
    } catch (err) {
      const msg = err instanceof Erro ? err.message : String(err)
      if (!isRecipientNotTodosowedErro(msg)) throw err
      lastErro = err
    }
  }
  if (lastErro) throw lastErro

  if (workingTelefone !== sanitized) {
    await db.from('contacts').update({ phone: workingTelefone }).eq('id', contact.id)
  }

  // Persist the sent message so it appears in the inbox with a real
  // Meta message id. sender_type='bot' distinguishes automation sends
  // from manual agent sends.
  const content_type = input.kind === 'template' ? 'template' : 'text'
  const content_text = input.kind === 'text' ? input.text : null
  const template_name = input.kind === 'template' ? input.templateNome : null

  const { error: msgErr } = await db.from('messages').insert({
    conversation_id: input.conversationId,
    sender_type: 'bot',
    content_type,
    content_text,
    template_name,
    message_id: waMessageId,
    status: 'sent',
  })
  if (msgErr) {
    // Meta already has the message; record the DB error but don't pretend
    // the send failed. The engine wraps this in a log line.
    throw new Erro(`sent to Meta but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text:
        input.kind === 'template' ? `[template:${input.templateNome}]` : input.text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId)

  return { whatsapp_message_id: waMessageId }
}
