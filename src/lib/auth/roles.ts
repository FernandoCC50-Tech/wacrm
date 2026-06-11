// ============================================================
// Account role helpers — pure, unit-testable, no I/O.
//
// Mirrors the `account_role_enum` Postgres type from migration
// 017_account_sharing.sql. The hierarchy is intentionally a flat
// ordinal (owner=4 … viewer=1) — it matches the same CASE
// expression the `is_account_member(account_id, min_role)` SQL
// helper uses, so server-side TypeScript guards and database-side
// RLS speak the same language.
//
// Predicates (`canManageMembros`, `canEditarSettings`, …) are the
// single source of truth for "what can this role do?" — both
// API route guards and UI gates should call them rather than
// open-coding their own role checks. That keeps role-policy
// changes a one-file diff.
// ============================================================

export type AccountFunção = "owner" | "admin" | "agent" | "viewer";

/** Ordered list of every valid role, lowest privilege first. */
export const ACCOUNT_ROLES: readonly AccountFunção[] = [
  "viewer",
  "agent",
  "admin",
  "owner",
] as const;

/**
 * Numeric rank of a role. Higher = more privileged. Mirrors the
 * CASE expression in `is_account_member` so JS/SQL stay aligned.
 */
export function roleRank(role: AccountFunção): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "agent":
      return 2;
    case "viewer":
      return 1;
  }
}

/**
 * True iff `role` is at least as privileged as `min`. Use this
 * for any "user has at least admin" / "at least agent" checks.
 */
export function hasMinFunção(role: AccountFunção, min: AccountFunção): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Type-narrow an unknown string into a valid `AccountFunção`. */
export function isAccountFunção(value: unknown): value is AccountFunção {
  return (
    typeof value === "string" &&
    (ACCOUNT_ROLES as readonly string[]).includes(value)
  );
}

// ============================================================
// Capability predicates
//
// Every UI gate and API route guard should call one of these
// instead of comparing role strings inline. Adicionaring a capability
// = one new predicate here + one call site change per consumer.
// ============================================================

/** Owner / admin: invite, remove, change roles. */
export function canManageMembros(role: AccountFunção): boolean {
  return hasMinFunção(role, "admin");
}

/**
 * Owner / admin: edit account-wide settings (WhatsApp config,
 * message templates, pipelines, tags, custom fields, account
 * name). Excludes per-user settings like avatar or own password.
 */
export function canEditarSettings(role: AccountFunção): boolean {
  return hasMinFunção(role, "admin");
}

/**
 * Owner / admin / agent: write operational data — send messages,
 * create contacts, move deals, run broadcasts, edit automations.
 * Viewers are read-only.
 */
export function canEnviarMessages(role: AccountFunção): boolean {
  return hasMinFunção(role, "agent");
}

/**
 * Viewer: read-only across everything. Provided as a positive
 * predicate so UI gates read naturally (`if (canViewOnly(role))`
 * shows the "Lido-only" tooltip without inverting `canEnviarMessages`).
 */
export function canViewOnly(role: AccountFunção): boolean {
  return role === "viewer";
}

/** Owner only: irreversible destructive operations. */
export function canExcluirAccount(role: AccountFunção): boolean {
  return role === "owner";
}

/** Owner only: hand the account to another member. */
export function canTransferOwnership(role: AccountFunção): boolean {
  return role === "owner";
}
