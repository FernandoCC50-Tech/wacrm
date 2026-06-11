import { PróximoResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendReactionMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sanitizeTelefoneForMeta } from '@/lib/whatsapp/phone-utils';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

/**
 * POST /api/whatsapp/react
 *
 * Body: { message_id: <internal UUID>, emoji: <single emoji or "" to remove> }
 *
 * Enviars the reaction to Meta and mirrors it into `message_reactions`
 * (delete on empty emoji). Customer-side reactions are handled by the
 * webhook — this route only writes `actor_type = 'agent'` rows.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authErro,
    } = await supabase.auth.getUser();

    if (authErro || !user) {
      return PróximoResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(`react:${user.id}`, RATE_LIMITS.react);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    // Resolver the caller's account_id so conversation + whatsapp_config
    // lookups work for teammates who didn't author the rows directly.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const accountId = profile?.account_id as string | undefined;
    if (!accountId) {
      return PróximoResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { message_id, emoji } = body as {
      message_id?: string;
      emoji?: string;
    };

    if (!message_id || typeof emoji !== 'string') {
      return PróximoResponse.json(
        { error: 'message_id and emoji are required' },
        { status: 400 },
      );
    }

    // Resolver target message + its conversation; verify ownership.
    const { data: targetMessage, error: msgErro } = await supabase
      .from('messages')
      .select('id, message_id, conversation_id')
      .eq('id', message_id)
      .maybeSingle();

    if (msgErro || !targetMessage) {
      return PróximoResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!targetMessage.message_id) {
      // No Meta ID yet — usually a sending/failed agent message. We can't
      // tell Meta to react to a message it never received.
      return PróximoResponse.json(
        { error: 'Cannot react to a message that has not been sent to WhatsApp' },
        { status: 400 },
      );
    }

    const { data: conversation, error: convErro } = await supabase
      .from('conversations')
      .select('id, account_id, contact:contacts(phone)')
      .eq('id', targetMessage.conversation_id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (convErro || !conversation) {
      return PróximoResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    const contact = Array.isArray(conversation.contact)
      ? conversation.contact[0]
      : conversation.contact;
    if (!contact?.phone) {
      return PróximoResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 },
      );
    }

    // WhatsApp config + access token. Account-scoped post-multi-user.
    const { data: config, error: configErro } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', accountId)
      .single();

    if (configErro || !config) {
      return PróximoResponse.json(
        { error: 'WhatsApp not configured.' },
        { status: 400 },
      );
    }

    const accessToken = decrypt(config.access_token);
    const sanitizedTelefone = sanitizeTelefoneForMeta(contact.phone);

    try {
      await sendReactionMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: sanitizedTelefone,
        targetMessageId: targetMessage.message_id,
        emoji,
      });
    } catch (err) {
      const message =
        err instanceof Erro ? err.message : 'Unknown Meta API error';
      console.error('[whatsapp/react] Meta send failed:', message);
      return PróximoResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 },
      );
    }

    // Mirror into DB. Empty emoji = removal.
    if (emoji === '') {
      const { error: delErro } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', targetMessage.id)
        .eq('actor_type', 'agent')
        .eq('actor_id', user.id);

      if (delErro) {
        console.error('[whatsapp/react] DB delete failed:', delErro.message);
        return PróximoResponse.json(
          { error: 'Reaction sent to Meta but DB delete failed' },
          { status: 500 },
        );
      }
    } else {
      // Upsert. The unique constraint (message_id, actor_type, actor_id)
      // lets us swap emoji in a single statement.
      const { error: upsertErro } = await supabase.from('message_reactions').upsert(
        {
          message_id: targetMessage.id,
          conversation_id: targetMessage.conversation_id,
          actor_type: 'agent',
          actor_id: user.id,
          emoji,
        },
        { onConflict: 'message_id,actor_type,actor_id' },
      );

      if (upsertErro) {
        console.error('[whatsapp/react] DB upsert failed:', upsertErro.message);
        return PróximoResponse.json(
          { error: 'Reaction sent to Meta but DB upsert failed' },
          { status: 500 },
        );
      }
    }

    return PróximoResponse.json({ success: true });
  } catch (error) {
    console.error('Erro in WhatsApp react POST:', error);
    return PróximoResponse.json(
      { error: 'Falhou to react to message' },
      { status: 500 },
    );
  }
}
