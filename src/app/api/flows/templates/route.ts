import { PróximoResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listFlowModelos } from '@/lib/flows/templates'

/**
 * GET /api/flows/templates
 *
 * Returns the static template gallery (slug + name + description +
 * icon hint + node_count) so the Novo-flow dialog can render cards
 * without bundling the full template payloads client-side. Bodies
 * are fetched only on actual clone via POST /api/flows.
 *
 * Available to any signed-in user. Flows is in soft-GA.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return PróximoResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Shallow shape so the client gallery doesn't have to know about
  // the full node tree.
  const templates = listFlowModelos().map((t) => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
    icon: t.icon,
    trigger_type: t.trigger_type,
    node_count: t.nodes.length,
  }))
  return PróximoResponse.json({ templates })
}
