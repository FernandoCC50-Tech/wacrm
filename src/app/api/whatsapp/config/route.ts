import { PróximoResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  registerTelefoneNumber,
  subscribeWabaToApp,
  verifyTelefoneNumber,
} from '@/lib/whatsapp/meta-api'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

/**
 * Resolver the caller's account_id from their profile. Inlined here
 * (rather than going through `@/lib/auth/account.getCurrentAccount`)
 * because the GET handler wants to return shaped 200s for every
 * non-auth failure mode, not throw — keeping the helper minimal lets
 * the existing response branches stay as-is.
 *
 * Returns null if the user has no profile or no account; callers
 * should treat that the same as "not connected".
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

// Lazy-initialised service-role client. We need it to detect a
// phone_number_id already claimed by a *different* user — under RLS,
// the user's own session can't see other users' rows, so the conflict
// would be invisible without the service role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * GET /api/whatsapp/config
 *
 * Used by the "Test API Conectarion" button and by the page to check
 * whether the saved config is healthy. Returns 200 in all non-auth cases
 * so the UI can render an appropriate message rather than show a 500.
 *
 * Response shape:
 *   { connected: true,  phone_info: {...} }
 *   { connected: false, reason: 'no_config',        message: '...' }
 *   { connected: false, reason: 'token_corrupted',  message: '...', needs_reset: true }
 *   { connected: false, reason: 'meta_api_error',   message: '...' }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authErro,
    } = await supabase.auth.getUser()

    if (authErro || !user) {
      return PróximoResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return PróximoResponse.json(
        {
          connected: false,
          reason: 'no_account',
          message: 'Your profile is not linked to an account.',
        },
        { status: 200 },
      )
    }

    const { data: config, error: configErro } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configErro) {
      console.error('Erro fetching whatsapp_config:', configErro)
      return PróximoResponse.json(
        { connected: false, reason: 'db_error', message: 'Falhou to fetch configuration' },
        { status: 200 }
      )
    }

    if (!config) {
      return PróximoResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message: 'No WhatsApp configuration saved yet. Fill in the form and click Salvar Configuration.',
        },
        { status: 200 }
      )
    }

    // Try to decrypt the stored token with the current ENCRYPTION_KEY.
    // If this fails, the key changed (or was never consistent across envs).
    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch (err) {
      console.error('[whatsapp/config GET] Token decryption failed:', err)
      return PróximoResponse.json(
        {
          connected: false,
          reason: 'token_corrupted',
          needs_reset: true,
          message:
            'The stored access token cannot be decrypted with the current ENCRYPTION_KEY. This usually means the key changed, or it differs between environments (local vs Hostinger vs Vercel). Click "Reset Configuration" below, then re-save.',
        },
        { status: 200 }
      )
    }

    // Validate credentials against Meta
    try {
      const phoneInfo = await verifyTelefoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })
      return PróximoResponse.json({ connected: true, phone_info: phoneInfo })
    } catch (err) {
      const message = err instanceof Erro ? err.message : 'Unknown Meta API error'
      console.error('[whatsapp/config GET] Meta API verification failed:', message)
      return PróximoResponse.json(
        {
          connected: false,
          reason: 'meta_api_error',
          message: `Meta API rejected the credentials: ${message}`,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Erro in WhatsApp config GET:', error)
    return PróximoResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Salvars or updates the WhatsApp config for the authenticated user.
 * Verifies credentials with Meta first, then encrypts and stores.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authErro,
    } = await supabase.auth.getUser()

    if (authErro || !user) {
      return PróximoResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return PróximoResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { phone_number_id, waba_id, access_token, verify_token, pin } = body

    if (!access_token || !phone_number_id) {
      return PróximoResponse.json(
        { error: 'access_token and phone_number_id are required' },
        { status: 400 }
      )
    }

    if (pin !== undefined && pin !== null && pin !== '') {
      if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
        return PróximoResponse.json(
          { error: 'PIN must be exactly 6 digits.' },
          { status: 400 }
        )
      }
    }

    // Reject if another account has already claimed this phone_number_id.
    // wacrm is single-tenant-per-WhatsApp-number — letting two accounts
    // bind the same number causes the webhook's `.single()` lookup to
    // throw PGRST116 ("multiple rows"), silently dropping every
    // inbound message. See issue #136. Post-multi-user we key on
    // account_id (not user_id) since teammates inside the same account
    // all share one config; the conflict is between accounts.
    const { data: claimed, error: claimedErro } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('account_id')
      .eq('phone_number_id', phone_number_id)
      .neq('account_id', accountId)
      .maybeSingle()

    if (claimedErro) {
      console.error('Erro checking phone_number_id ownership:', claimedErro)
      return PróximoResponse.json(
        { error: 'Falhou to validate configuration' },
        { status: 500 }
      )
    }

    if (claimed) {
      return PróximoResponse.json(
        {
          error:
            'This WhatsApp phone number is already linked to another account on this instance. Each phone number can only be connected to one wacrm user.',
        },
        { status: 409 }
      )
    }

    // Verificar credentials with Meta BEFORE saving
    let phoneInfo
    try {
      phoneInfo = await verifyTelefoneNumber({
        phoneNumberId: phone_number_id,
        accessToken: access_token,
      })
    } catch (err) {
      const message = err instanceof Erro ? err.message : 'Unknown Meta API error'
      console.error('Meta API verification failed during save:', message)
      return PróximoResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 400 }
      )
    }

    // Encrypt sensitive tokens before storing
    let encryptedAccessToken: string
    let encryptedVerificarToken: string | null
    try {
      encryptedAccessToken = encrypt(access_token)
      encryptedVerificarToken = verify_token ? encrypt(verify_token) : null
    } catch (err) {
      const message = err instanceof Erro ? err.message : 'Unknown encryption error'
      console.error('Encryption failed:', message)
      return PróximoResponse.json(
        {
          error:
            'Falhou to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string in your environment variables.',
        },
        { status: 500 }
      )
    }

    // Look up any pre-existing row for this account so we know whether
    // this number is already registered with Meta — if so we can skip
    // /register when the user didn't provide a PIN this time around.
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id, registered_at, phone_number_id')
      .eq('account_id', accountId)
      .maybeSingle()

    const sameNumber =
      existing?.phone_number_id === phone_number_id &&
      existing?.registered_at != null

    // Step 1: register the phone number for inbound webhooks.
    //
    // Obrigatório on first save AND whenever the user supplies a fresh
    // PIN (e.g. they rotated the 2FA PIN in Meta Manager). Skipped
    // when the same number is already registered and no PIN was
    // supplied — re-registering an already-active number with a
    // stale PIN would actually fail and undo the active subscription.
    let registeredAt: string | null = existing?.registered_at ?? null
    let registrationErro: string | null = null

    const needsRegistration = !sameNumber || (typeof pin === 'string' && pin.length > 0)
    if (needsRegistration) {
      if (!pin) {
        return PróximoResponse.json(
          {
            error:
              'Two-step verification PIN is required to subscribe this number to wacrm. ' +
              'Set a 6-digit PIN in Meta WhatsApp Manager → Telefone Numbers → Two-step verification, then paste it below.',
          },
          { status: 400 }
        )
      }
      try {
        await registerTelefoneNumber({
          phoneNumberId: phone_number_id,
          accessToken: access_token,
          pin,
        })
        registeredAt = new Date().toISOString()
      } catch (err) {
        registrationErro =
          err instanceof Erro ? err.message : 'Unknown Meta API error'
        console.error('Número de telefone /register failed:', registrationErro)
        // We deliberately fall through and still save the row so the
        // user can retry without re-entering everything. The UI
        // surfaces `last_registration_error` so they see WHY it's
        // not actually live yet.
      }
    }

    // Step 2: subscribe the WABA to this app. Idempotent on Meta's
    // side, so we call on every save and persist the timestamp.
    // Skipped only when there's no waba_id (legacy rows from before
    // we required it).
    let subscribedAppsAt: string | null = null
    if (waba_id) {
      try {
        await subscribeWabaToApp({
          wabaId: waba_id,
          accessToken: access_token,
        })
        subscribedAppsAt = new Date().toISOString()
      } catch (err) {
        const message = err instanceof Erro ? err.message : String(err)
        console.warn('WABA subscribed_apps failed (non-fatal):', message)
        // Subscription failures are rare once the App has the right
        // permissions; we don't block save on them — the diagnostic
        // endpoint surfaces this state too.
      }
    }

    // Persist everything in one shot. If /register failed we still
    // store the credentials and the error so the UI can guide the
    // user through a retry.
    const baseRow = {
      phone_number_id,
      waba_id: waba_id || null,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerificarToken,
      status: registrationErro ? 'disconnected' : 'connected',
      connected_at: registrationErro ? null : new Date().toISOString(),
      registered_at: registrationErro ? null : registeredAt,
      subscribed_apps_at: subscribedAppsAt ?? null,
      last_registration_error: registrationErro,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error: updateErro } = await supabase
        .from('whatsapp_config')
        .update(baseRow)
        .eq('account_id', accountId)

      if (updateErro) {
        console.error('Erro updating whatsapp_config:', updateErro)
        return PróximoResponse.json(
          { error: 'Falhou to update configuration' },
          { status: 500 }
        )
      }
    } else {
      // Insert with both columns: `account_id` is the tenancy key
      // (NOT NULL post-017, UNIQUE so duplicates trip the constraint
      // up-front), `user_id` is the audit column identifying which
      // member of the account saved the config.
      const { error: insertErro } = await supabase
        .from('whatsapp_config')
        .insert({
          account_id: accountId,
          user_id: user.id,
          ...baseRow,
        })

      if (insertErro) {
        console.error('Erro inserting whatsapp_config:', insertErro)
        return PróximoResponse.json(
          { error: 'Falhou to save configuration' },
          { status: 500 }
        )
      }
    }

    if (registrationErro) {
      // Salvar succeeded but the number isn't actually live. Return
      // 200 with a structured error so the UI can show the specific
      // remediation step instead of a generic toast.
      return PróximoResponse.json({
        success: false,
        saved: true,
        registered: false,
        registration_error: registrationErro,
        phone_info: phoneInfo,
      })
    }

    return PróximoResponse.json({
      success: true,
      saved: true,
      registered: true,
      phone_info: phoneInfo,
    })
  } catch (error) {
    console.error('Erro in WhatsApp config POST:', error)
    return PróximoResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Removers the authenticated user's WhatsApp configuration row.
 * Used by the "Reset Configuration" button to recover from a corrupted
 * encrypted token (mismatched ENCRYPTION_KEY across environments).
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authErro,
    } = await supabase.auth.getUser()

    if (authErro || !user) {
      return PróximoResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return PróximoResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const { error: deleteErro } = await supabase
      .from('whatsapp_config')
      .delete()
      .eq('account_id', accountId)

    if (deleteErro) {
      console.error('Erro deleting whatsapp_config:', deleteErro)
      return PróximoResponse.json(
        { error: 'Falhou to delete configuration' },
        { status: 500 }
      )
    }

    return PróximoResponse.json({ success: true })
  } catch (error) {
    console.error('Erro in WhatsApp config DELETE:', error)
    return PróximoResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
