import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROLES,
  type AccountFunção,
  canExcluirAccount,
  canEditarSettings,
  canManageMembros,
  canEnviarMessages,
  canTransferOwnership,
  canViewOnly,
  hasMinFunção,
  isAccountFunção,
  roleRank,
} from "./roles";

describe("roleRank", () => {
  it("orders owner > admin > agent > viewer", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("agent"));
    expect(roleRank("agent")).toBeGreaterThan(roleRank("viewer"));
  });

  it("matches the SQL helper's numeric mapping", () => {
    // Keep these in lockstep with `is_account_member`'s CASE expression
    // in supabase/migrations/017_account_sharing.sql — any change here
    // means the SQL helper needs the same change.
    expect(roleRank("owner")).toBe(4);
    expect(roleRank("admin")).toBe(3);
    expect(roleRank("agent")).toBe(2);
    expect(roleRank("viewer")).toBe(1);
  });
});

describe("hasMinFunção", () => {
  it("returns true when role meets the threshold", () => {
    expect(hasMinFunção("owner", "viewer")).toBe(true);
    expect(hasMinFunção("admin", "agent")).toBe(true);
    expect(hasMinFunção("agent", "agent")).toBe(true);
  });

  it("returns false when role is below the threshold", () => {
    expect(hasMinFunção("viewer", "agent")).toBe(false);
    expect(hasMinFunção("agent", "admin")).toBe(false);
    expect(hasMinFunção("admin", "owner")).toBe(false);
  });

  // The full matrix — useful as a regression net if anyone reshuffles
  // the rank table.
  it.each<[AccountFunção, AccountFunção, boolean]>([
    ["owner", "owner", true],
    ["owner", "admin", true],
    ["owner", "agent", true],
    ["owner", "viewer", true],
    ["admin", "owner", false],
    ["admin", "admin", true],
    ["admin", "agent", true],
    ["admin", "viewer", true],
    ["agent", "owner", false],
    ["agent", "admin", false],
    ["agent", "agent", true],
    ["agent", "viewer", true],
    ["viewer", "owner", false],
    ["viewer", "admin", false],
    ["viewer", "agent", false],
    ["viewer", "viewer", true],
  ])("%s vs min %s → %s", (role, min, expected) => {
    expect(hasMinFunção(role, min)).toBe(expected);
  });
});

describe("isAccountFunção", () => {
  it("accepts every value in ACCOUNT_ROLES", () => {
    for (const role of ACCOUNT_ROLES) {
      expect(isAccountFunção(role)).toBe(true);
    }
  });

  it("rejects garbage / case mismatch / non-strings", () => {
    expect(isAccountFunção("Proprietário")).toBe(false);
    expect(isAccountFunção("")).toBe(false);
    expect(isAccountFunção(null)).toBe(false);
    expect(isAccountFunção(undefined)).toBe(false);
    expect(isAccountFunção(123)).toBe(false);
    expect(isAccountFunção("superuser")).toBe(false);
  });
});

describe("capability predicates", () => {
  it("canManageMembros: admin+ only", () => {
    expect(canManageMembros("owner")).toBe(true);
    expect(canManageMembros("admin")).toBe(true);
    expect(canManageMembros("agent")).toBe(false);
    expect(canManageMembros("viewer")).toBe(false);
  });

  it("canEditarSettings: admin+ only", () => {
    expect(canEditarSettings("owner")).toBe(true);
    expect(canEditarSettings("admin")).toBe(true);
    expect(canEditarSettings("agent")).toBe(false);
    expect(canEditarSettings("viewer")).toBe(false);
  });

  it("canEnviarMessages: agent+ only", () => {
    expect(canEnviarMessages("owner")).toBe(true);
    expect(canEnviarMessages("admin")).toBe(true);
    expect(canEnviarMessages("agent")).toBe(true);
    expect(canEnviarMessages("viewer")).toBe(false);
  });

  it("canViewOnly: viewer only", () => {
    expect(canViewOnly("owner")).toBe(false);
    expect(canViewOnly("admin")).toBe(false);
    expect(canViewOnly("agent")).toBe(false);
    expect(canViewOnly("viewer")).toBe(true);
  });

  it("canExcluirAccount: owner only", () => {
    expect(canExcluirAccount("owner")).toBe(true);
    expect(canExcluirAccount("admin")).toBe(false);
    expect(canExcluirAccount("agent")).toBe(false);
    expect(canExcluirAccount("viewer")).toBe(false);
  });

  it("canTransferOwnership: owner only", () => {
    expect(canTransferOwnership("owner")).toBe(true);
    expect(canTransferOwnership("admin")).toBe(false);
    expect(canTransferOwnership("agent")).toBe(false);
    expect(canTransferOwnership("viewer")).toBe(false);
  });
});
