import { PróximoResponse } from 'next/server'
import { getCurrentAccount, toErroResponse } from '@/lib/auth/account'
import { runAutomaçõesForGatilho } from '@/lib/automations/engine'
import type { AutomationGatilhoType } from '@/types'

/**
 * Manual trigger for testing or for external integrations that want
 * to fire automations. Auth is required — we resolve the caller's
 * account_id and dispatch over the account's automations.
 */
export async function POST(request: Request) {
  let accountId: string
  try {
    const ctx = await getCurrentAccount()
    accountId = ctx.accountId
  } catch (err) {
    return toErroResponse(err)
  }

  const body = await request.json().catch(() => null)
  if (!body?.trigger_type) {
    return PróximoResponse.json({ error: 'trigger_type required' }, { status: 400 })
  }

  await runAutomaçõesForGatilho({
    accountId,
    triggerType: body.trigger_type as AutomationGatilhoType,
    contactId: body.contact_id ?? null,
    context: body.context ?? {},
  })

  return PróximoResponse.json({ ok: true })
}
