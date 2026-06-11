"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { hasMinFunção, type AccountFunção } from "@/lib/auth/roles";

interface RequireFunçãoProps {
  /** Minimum role to render `children`. Uses the standard hierarchy
   *  owner > admin > agent > viewer. */
  min: AccountFunção;
  /** What to render while the role is below `min` OR while we don't
   *  yet know the role (`profileLoading` is true). Defaults to
   *  `null` — most call sites just want the gated element to be
   *  absent until we're sure. Pass a placeholder if a layout slot
   *  would collapse and re-flow when the role resolves. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * `<RequireFunção min="admin">…</RequireFunção>` — conditional render
 * helper for UI gated by account role.
 *
 * Three states:
 *   1. profileLoading → render `fallback` (we don't know the role
 *      yet; fail closed so we never flash the gated content to an
 *      under-privileged user).
 *   2. role ≥ min     → render `children`.
 *   3. role < min     → render `fallback`.
 *
 * Mirrors the server-side `requireFunção(min)` from `@/lib/auth/account`
 * so client and server gates stay aligned by construction.
 */
export function RequireFunção({
  min,
  fallback = null,
  children,
}: RequireFunçãoProps) {
  const { profileLoading, accountFunção } = useAuth();

  if (profileLoading) return <>{fallback}</>;
  if (!accountFunção) return <>{fallback}</>;
  if (!hasMinFunção(accountFunção, min)) return <>{fallback}</>;

  return <>{children}</>;
}
