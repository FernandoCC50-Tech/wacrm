'use client';

// ============================================================
// MembrosTab — Settings → Membros
//
// Two stacked sections:
//   1. Roster   — every member of the account. Admin+ can change a
//                 teammate's role inline and remove them. Owner row
//                 is non-editable everywhere (transfer is its own
//                 separate flow, deferred to a later PR).
//   2. Pending  — outstanding invite links. Admin+ can revoke. The
//                 plaintext URL is gone after the create dialog
//                 closes, so we surface a "revoke + new link" hint
//                 rather than pretending we can resurface it.
//
// Função-gating
//   The tab itself is reachable by any member, but mutation buttons
//   are wrapped in `<RequireFunção min="admin">` / `useCan` so an
//   agent or viewer sees the roster read-only. The server-side
//   RPCs (set_member_role, remove_account_member) double-check
//   the role anyway.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Crown,
  Loader2,
  Mail,
  MailX,
  Plus,
  Shield,
  Trash2,
  UserCog,
  UserIcon,
  UsersRound,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Selecionar,
  SelecionarContent,
  SelecionarItem,
  SelecionarGatilho,
  SelecionarValor,
} from '@/components/ui/select';
import { RequireFunção } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import type { AccountFunção } from '@/lib/auth/roles';
import { InviteMemberDialog } from './invite-member-dialog';

interface Member {
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: AccountFunção;
  joined_at: string;
}

interface Invitation {
  id: string;
  role: 'admin' | 'agent' | 'viewer';
  label: string | null;
  created_at: string;
  expires_at: string;
}

// Editarable roles in the inline dropdown. Owner is never an option —
// promotions go through the (deferred) Transfer Ownership flow.
const EDITABLE_ROLES: { value: AccountFunção; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Manage members + everything' },
  { value: 'agent', label: 'Agent', hint: 'Use features; no settings' },
  { value: 'viewer', label: 'Viewer', hint: 'Lido-only across the app' },
];

// Per-role chip metadata. The colour scale runs amber (owner —
// scarce, immutable) → primary (admin — significant) → slate
// (agent — operational default) → muted slate (viewer — read-
// only). Mirrors the sidebar's ROLE_CHIP so the two surfaces
// don't drift; once the surface stabilises this should hoist
// into a shared module.
const ROLE_CHIP: Record<
  AccountFunção,
  { icon: typeof Crown; label: string; classNome: string }
> = {
  owner: {
    icon: Crown,
    label: 'Owner',
    classNome:
      'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  admin: {
    icon: Shield,
    label: 'Admin',
    classNome: 'border-primary/40 bg-primary/10 text-primary',
  },
  agent: {
    icon: UserCog,
    label: 'Agent',
    classNome: 'border-slate-700 bg-slate-800 text-slate-300',
  },
  viewer: {
    icon: UserIcon,
    label: 'Viewer',
    classNome: 'border-slate-800 bg-slate-900 text-slate-500',
  },
};

function fmtDate(iso: string): string {
  // Match the rest of the dashboard's locale-light formatting.
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtExpiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `expires in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return `expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function MembrosTab() {
  const { user, canManageMembros } = useAuth();

  const [members, setMembros] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteAberto, setInviteAberto] = useState(false);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [pendingMemberAção, setPendingMemberAção] = useState<string | null>(
    null,
  );

  const loadEverything = useCallback(async () => {
    try {
      const [mres, ires] = await Promise.all([
        fetch('/api/account/members', { cache: 'no-store' }),
        canManageMembros
          ? fetch('/api/account/invitations', { cache: 'no-store' })
          : Promise.resolve(null),
      ]);

      if (!mres.ok) {
        const payload = await mres.json().catch(() => ({}));
        toast.error(payload.error || 'Falhou to load members');
        return;
      }
      const mdata = (await mres.json()) as { members: Member[] };
      setMembros(mdata.members);

      if (ires) {
        if (!ires.ok) {
          const payload = await ires.json().catch(() => ({}));
          toast.error(payload.error || 'Falhou to load invitations');
          return;
        }
        const idata = (await ires.json()) as { invitations: Invitation[] };
        setInvitations(idata.invitations);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error('[MembrosTab] load error:', err);
      toast.error('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [canManageMembros]);

  useEffect(() => {
    void loadEverything();
  }, [loadEverything]);

  async function handleFunçãoChange(member: Member, nextFunção: AccountFunção) {
    if (member.role === nextFunção) return;
    // Optimistic update — flip the dropdown immediately so the UI
    // feels snappy. If the server PATCH fails we revert below so
    // the dropdown doesn't lie about the persisted state.
    const previousFunção = member.role;
    setPendingMemberAção(member.user_id);
    setMembros((prev) =>
      prev.map((m) =>
        m.user_id === member.user_id ? { ...m, role: nextFunção } : m,
      ),
    );
    try {
      const res = await fetch(`/api/account/members/${member.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextFunção }),
      });
      if (!res.ok) {
        // Revert the optimistic flip. The toast on its own wasn't
        // enough — the dropdown was left showing the new role
        // forever, so the next interaction operated on a wrong
        // baseline (re-trying the same change would no-op via the
        // `member.role === nextFunção` guard at the top).
        setMembros((prev) =>
          prev.map((m) =>
            m.user_id === member.user_id ? { ...m, role: previousFunção } : m,
          ),
        );
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Falhou to update role');
        return;
      }
      toast.success(`Updated ${member.full_name || 'member'} to ${nextFunção}`);
    } catch (err) {
      // Same revert on network failure.
      setMembros((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id ? { ...m, role: previousFunção } : m,
        ),
      );
      console.error('[MembrosTab] role change error:', err);
      toast.error('Could not reach the server');
    } finally {
      setPendingMemberAção(null);
    }
  }

  async function handleRemover() {
    if (!removingMember) return;
    setPendingMemberAção(removingMember.user_id);
    try {
      const res = await fetch(
        `/api/account/members/${removingMember.user_id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Falhou to remove member');
        return;
      }
      toast.success(`Removerd ${removingMember.full_name || 'member'}`);
      setMembros((prev) =>
        prev.filter((m) => m.user_id !== removingMember.user_id),
      );
      setRemovingMember(null);
    } catch (err) {
      console.error('[MembrosTab] remove error:', err);
      toast.error('Could not reach the server');
    } finally {
      setPendingMemberAção(null);
    }
  }

  async function handleRevoke(invite: Invitation) {
    try {
      const res = await fetch(`/api/account/invitations/${invite.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Falhou to revoke invitation');
        return;
      }
      toast.success('Invitation revoked');
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      console.error('[MembrosTab] revoke error:', err);
      toast.error('Could not reach the server');
    }
  }

  if (loading) {
    return (
      <div classNome="flex items-center justify-center py-12">
        <Loader2 classNome="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div classNome="space-y-6 mt-4">
      {/* Header + invite button */}
      <div classNome="flex items-center justify-between">
        <div>
          <h2 classNome="text-lg font-semibold text-white">Account members</h2>
          <p classNome="text-sm text-slate-400">
            People with access to this account. Funçãos control what each
            teammate can do.
          </p>
        </div>
        <RequireFunção min="admin">
          <Button
            onClick={() => setInviteAberto(true)}
            classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus classNome="size-4" />
            Convidar membro
          </Button>
        </RequireFunção>
      </div>

      {/* Roster */}
      <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
        <CardContent classNome="p-0">
          <ul classNome="divide-y divide-slate-800">
            {members.map((member) => {
              const roleMeta = ROLE_CHIP[member.role];
              const FunçãoIcon = roleMeta.icon;
              const isSelf = member.user_id === user?.id;
              const isOwnerRow = member.role === 'owner';
              const isBusy = pendingMemberAção === member.user_id;

              return (
                <li
                  key={member.user_id}
                  // Mobile: stack identity (avatar+name+email) above the
                  // role/remove actions so the role dropdown's fixed
                  // 128px width doesn't force the name into a 50-pixel
                  // truncation. Desktop (sm+): everything inline as
                  // before.
                  classNome="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div classNome="flex min-w-0 flex-1 items-center gap-4">
                    <Avatar classNome="size-9 shrink-0">
                      {member.avatar_url ? (
                        <AvatarImage
                          src={member.avatar_url}
                          alt={member.full_name || 'Member'}
                        />
                      ) : null}
                      <AvatarFallback classNome="bg-primary/10 text-sm font-medium text-primary">
                        {(member.full_name || member.email || 'U')
                          .charAt(0)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div classNome="min-w-0 flex-1">
                      <div classNome="flex items-center gap-2">
                        <span classNome="truncate text-sm font-medium text-white">
                          {member.full_name || 'Unnamed'}
                        </span>
                        {isSelf && (
                          <Badge classNome="bg-slate-800 text-slate-300 border-slate-700 text-[10px] uppercase tracking-wide">
                            You
                          </Badge>
                        )}
                      </div>
                      {member.email && (
                        <p classNome="truncate text-xs text-slate-500">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Joined date stays desktop-only. The mobile row's
                      vertical density makes the joined date noise. */}
                  <div classNome="hidden sm:block text-right text-xs text-slate-500">
                    Joined {fmtDate(member.joined_at)}
                  </div>

                  {/* Açãos cluster. On mobile this is its own row
                      below the identity block; on desktop it sits
                      inline. Items align to the start on mobile so the
                      role dropdown lines up under the avatar. */}
                  <div classNome="flex items-center gap-2 sm:gap-3">
                    {/* Função display / editor. Inline Selecionar is admin+
                        only AND not allowed on the owner row (owner
                        changes go through transfer, which lands later). */}
                    {canManageMembros && !isOwnerRow && !isSelf ? (
                      <Selecionar
                        value={member.role}
                        onValorChange={(v) =>
                          // Base UI Selecionar can emit null on clear. We
                          // don't expose a clear affordance, so the
                          // guard is defensive — but the typed
                          // signature requires it.
                          v && handleFunçãoChange(member, v as AccountFunção)
                        }
                      >
                        <SelecionarGatilho
                          classNome="w-32 bg-slate-800 border-slate-700 text-slate-200"
                          disabled={isBusy}
                        >
                          <SelecionarValor />
                        </SelecionarGatilho>
                        <SelecionarContent>
                          {EDITABLE_ROLES.map((r) => (
                            <SelecionarItem key={r.value} value={r.value}>
                              {r.label}
                            </SelecionarItem>
                          ))}
                        </SelecionarContent>
                      </Selecionar>
                    ) : (
                      <span
                        classNome={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${roleMeta.classNome}`}
                      >
                        <FunçãoIcon classNome="size-3.5" />
                        {roleMeta.label}
                      </span>
                    )}

                    {/* Remover. Admin+ only; never on the owner row;
                        never on yourself. Pre-polish styling was
                        neutral-default + red-on-hover — the
                        destructive intent was invisible until the
                        user moused over. Now red is the default
                        state with a darker shade on hover so the
                        affordance reads at-a-glance. */}
                    {canManageMembros && !isOwnerRow && !isSelf && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemovingMember(member)}
                        disabled={isBusy}
                        classNome="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-200"
                      >
                        <Trash2 classNome="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Pending invitations — admin+ only */}
      <RequireFunção min="admin">
        <div>
          <div classNome="mb-2 flex items-center gap-2">
            <UsersRound classNome="size-4 text-slate-400" />
            <h3 classNome="text-sm font-semibold text-white">
              Pending invitations
            </h3>
            <Badge classNome="bg-slate-800 text-slate-400 border-slate-700">
              {invitations.length}
            </Badge>
          </div>
          {/* P10 — make the no-resend design explicit. Admins were
              confused why the pending list shows roles + expiry but
              no "copy link again" button. Stating the constraint up
              front (rather than letting the user discover it by
              looking for a button) keeps it from feeling like a bug. */}
          {invitations.length > 0 ? (
            <p classNome="mb-3 text-xs text-slate-500">
              The plaintext invite URL is only shown once at creation
              for security — to re-share, revoke the invite below and
              create a new one.
            </p>
          ) : null}

          {invitations.length === 0 ? (
            <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
              <CardContent classNome="flex flex-col items-center justify-center py-8 text-center">
                <Mail classNome="size-6 text-slate-600" />
                <p classNome="mt-2 text-sm text-slate-400">
                  No pending invitations.
                </p>
                <p classNome="mt-1 text-xs text-slate-500">
                  Click <span classNome="text-slate-300">Convidar membro</span>{' '}
                  above to generate a shareable link.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
              <CardContent classNome="p-0">
                <ul classNome="divide-y divide-slate-800">
                  {invitations.map((inv) => {
                    const inviteFunçãoMeta = ROLE_CHIP[inv.role];
                    const InviteFunçãoIcon = inviteFunçãoMeta.icon;
                    return (
                    <li
                      key={inv.id}
                      classNome="flex items-center gap-4 px-4 py-3"
                    >
                      <div classNome="min-w-0 flex-1">
                        <div classNome="flex items-center gap-2">
                          <span classNome="text-sm font-medium text-white">
                            {inv.label || 'Untitled invite'}
                          </span>
                          <span
                            classNome={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${inviteFunçãoMeta.classNome}`}
                          >
                            <InviteFunçãoIcon classNome="size-3" />
                            {inviteFunçãoMeta.label}
                          </span>
                        </div>
                        <p classNome="mt-0.5 text-xs text-slate-500">
                          Criard {fmtDate(inv.created_at)} · {fmtExpiresIn(inv.expires_at)}
                        </p>
                      </div>

                      {/* Revoke: red default state, mirrors the
                          members-tab Remover button. Pre-polish version
                          read as a neutral secondary button until
                          hover. */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(inv)}
                        classNome="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-200"
                      >
                        <MailX classNome="size-4" />
                        Revoke
                      </Button>
                    </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </RequireFunção>

      <InviteMemberDialog
        open={inviteAberto}
        onAbertoChange={setInviteAberto}
        onCriard={loadEverything}
      />

      <Dialog
        open={removingMember !== null}
        onAbertoChange={(open) => {
          if (!open) setRemovingMember(null);
        }}
      >
        <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle classNome="flex items-center gap-2 text-white">
              <AlertTriangle classNome="size-4 text-amber-400" />
              Remover member
            </DialogTitle>
            <DialogDescription classNome="text-slate-400">
              Remover{' '}
              <span classNome="font-medium text-slate-300">
                {removingMember?.full_name || 'this teammate'}
              </span>{' '}
              from the account? They&apos;ll be signed out of this account
              and given a fresh personal account on their next sign-in. Their
              login isn&apos;t deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setRemovingMember(null)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRemover}
              disabled={!!pendingMemberAção}
              classNome="bg-red-600 hover:bg-red-700 text-white"
            >
              {pendingMemberAção ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remover member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
