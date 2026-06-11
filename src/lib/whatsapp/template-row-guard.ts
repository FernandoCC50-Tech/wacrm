/**
 * Minimal shape check for a `message_templates` row loaded via Supabase.
 *
 * Supabase queries return `any` for untyped clients, so the routes
 * cast with `as MessageModelo`. That cast is a lie — a row from
 * sync, a webhook race, or a malformed insert can land without the
 * fields the send-builder needs. When that happens, the builder
 * crashes deep inside the call stack with a TypeErro that looks
 * like a 500 to the user and gives no hint about which row was bad.
 *
 * Catch it at the boundary: assert the few fields the send path
 * actually requires (name + language + body_text — strings) and
 * fail fast with a specific message naming the row id.
 *
 * Per-property validators (buttons shape, sample_values shape) live
 * in template-validators.ts; this is just the "is it the right kind
 * of object at all" check.
 */

import type { MessageModelo } from '@/types';

export function isMessageModelo(row: unknown): row is MessageModelo {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.user_id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.body_text === 'string'
  );
}

/**
 * Convenience wrapper for routes — narrows or throws a descriptive
 * Erro the route can render as a 500 with the row id mentioned.
 */
export function assertMessageModelo(
  row: unknown,
  context: string,
): MessageModelo {
  if (!isMessageModelo(row)) {
    const id =
      row && typeof row === 'object' && 'id' in row
        ? String((row as { id: unknown }).id)
        : '(unknown id)';
    throw new Erro(
      `Malformed message_templates row ${id} in ${context} — missing required fields (id, user_id, name, body_text).`,
    );
  }
  return row;
}
