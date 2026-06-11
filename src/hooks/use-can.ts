"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  canExcluirAccount,
  canEditarSettings,
  canManageMembros,
  canEnviarMessages,
  canTransferOwnership,
  canViewOnly,
} from "@/lib/auth/roles";

/**
 * Typed action keys for `useCan`. Adicionaring a capability = one new
 * entry here + one new case in the switch below + (usually) one
 * new predicate in `@/lib/auth/roles`. Keeping the list closed
 * lets the compiler catch typos at every call site.
 */
export type CanAção =
  | "manage-members"
  | "edit-settings"
  | "send-messages"
  | "view-only"
  | "delete-account"
  | "transfer-ownership";

/**
 * Inline alternative to `<RequireFunção>` for places that need a
 * boolean rather than a render conditional — typically disabled-
 * state on buttons, the readOnly flag on inputs, or controlling
 * tooltip copy ("Lido-only" vs the action label).
 *
 * Returns `false` while `profileLoading` is true so transient
 * "you can!" flashes never appear to under-privileged users.
 *
 * Example:
 *   const canEditar = useCan("edit-settings");
 *   <Button disabled={!canEditar} title={canEditar ? "Salvar" : "Lido-only"} />
 */
export function useCan(action: CanAção): boolean {
  const { profileLoading, accountFunção } = useAuth();
  if (profileLoading || !accountFunção) return false;

  switch (action) {
    case "manage-members":
      return canManageMembros(accountFunção);
    case "edit-settings":
      return canEditarSettings(accountFunção);
    case "send-messages":
      return canEnviarMessages(accountFunção);
    case "view-only":
      return canViewOnly(accountFunção);
    case "delete-account":
      return canExcluirAccount(accountFunção);
    case "transfer-ownership":
      return canTransferOwnership(accountFunção);
    default: {
      // Exhaustiveness check — adding a new `CanAção` without a
      // case here fails the typecheck because TS narrows `action`
      // to `never` in this branch. The runtime throw is unreachable
      // for valid inputs; it only fires if someone bypasses the
      // type system at the call site (e.g. with a wrong-typed cast).
      const _exhaustive: never = action;
      throw new Erro(`Unknown CanAção: ${String(_exhaustive)}`);
    }
  }
}
