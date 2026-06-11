'use client';

// ============================================================
// /join/[token] — invitation redemption landing page.
//
// Four UI states driven by:
//   - the peek result (server-validated invite payload), and
//   - whether the visitor is currently authenticated.
//
//   ┌──────────────────────┬───────────────┬─────────────────────────┐
//   │ peek                 │ auth          │ render                   │
//   ├──────────────────────┼───────────────┼─────────────────────────┤
//   │ loading              │ —             │ spinner                  │
//   │ ok:false (any reason)│ —             │ friendly error + signup  │
//   │ ok:true              │ signed out    │ "Sign up" + "Entrar"    │
//   │ ok:true              │ signed in     │ "Accept" button → redeem │
//   └──────────────────────┴───────────────┴─────────────────────────┘
//
// We deliberately do NOT redeem automatically on page load — the
// invitee should confirm what account/role they're accepting.
// Auto-redeem would also race with the signup flow returning to
// this page after email verification.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  MailX,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

interface PeekOk {
  ok: true;
  account_name: string;
  role: 'admin' | 'agent' | 'viewer';
  expires_at: string;
}
interface PeekFail {
  ok: false;
  reason: 'not_found' | 'used' | 'expired' | 'server_error';
}
type PeekResult = PeekOk | PeekFail;

const ROLE_LABEL: Record<PeekOk['role'], string> = {
  admin: 'Admin',
  agent: 'Agent',
  viewer: 'Viewer',
};

const FAIL_COPY: Record<PeekFail['reason'], { title: string; body: string }> = {
  not_found: {
    title: 'Invite not found',
    body: 'This link doesn’t match a valid invitation. Double-check the URL or ask the person who invited you to send a new one.',
  },
  used: {
    title: 'Invite already used',
    body: 'This invitation has already been accepted. If that wasn’t you, ask the account admin to send a fresh link.',
  },
  expired: {
    title: 'Invite expired',
    body: 'This invitation has expired. Ask the account admin to send a new one — they take a few seconds to generate.',
  },
  server_error: {
    title: 'Algo deu errado',
    body: 'We couldn’t verify this invitation right now. Try refreshing the page in a moment.',
  },
};

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [peek, setPeek] = useState<PeekResult | null>(null);
  // Local auth probe — the AuthProvider lives inside the (dashboard)
  // route group, so it doesn't reach this page. We hit Supabase
  // directly the same way `/login` and `/signup` do.
  const [authedUserId, setAuthedUserId] = useState<string | null | undefined>(
    undefined, // undefined = unknown / still loading; null = signed out
  );
  const [accepting, setAccepting] = useState(false);
  // `redeem_invitation` returns 409 when the caller's current account
  // has domain data, or they're already a member of a shared account.
  // A transient toast wasn't enough — the user has no actionable next
  // step. Surface a blocking modal that walks them through it.
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Extracted so the "Tentar novamente" button on the server_error card
  // can re-run the same logic without remounting the component.
  const loadPeekAndAuth = useCallback(async () => {
    if (!token) return;
    setPeek(null);
    setAuthedUserId(undefined);
    try {
      const [peekRes, authRes] = await Promise.all([
        fetch(`/api/invitations/${encodeURIComponent(token)}/peek`, {
          cache: 'no-store',
        }),
        createClient().auth.getUser(),
      ]);
      const peekBody = (await peekRes.json()) as PeekResult;
      setPeek(peekBody);
      setAuthedUserId(authRes.data.user?.id ?? null);
    } catch (err) {
      console.error('[join] peek error:', err);
      setPeek({ ok: false, reason: 'server_error' });
      setAuthedUserId(null);
    }
  }, [token]);

  // Fetch peek + auth state on mount. The peek endpoint is
  // rate-limited per-IP (30/min) so double-mounting in React 19
  // strict mode dev is harmless. We also use the `cancelled` flag
  // to drop setState calls if the component unmounts mid-fetch.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [peekRes, authRes] = await Promise.all([
          fetch(`/api/invitations/${encodeURIComponent(token)}/peek`, {
            cache: 'no-store',
          }),
          createClient().auth.getUser(),
        ]);
        const peekBody = (await peekRes.json()) as PeekResult;
        if (cancelled) return;
        setPeek(peekBody);
        setAuthedUserId(authRes.data.user?.id ?? null);
      } catch (err) {
        console.error('[join] peek error:', err);
        if (cancelled) return;
        setPeek({ ok: false, reason: 'server_error' });
        setAuthedUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch(
        `/api/invitations/${encodeURIComponent(token)}/redeem`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        // 409 = caller already has data / is in another shared
        // account. The redeem RPC's error message is descriptive
        // enough to show directly; we open a modal so the user has
        // a clear next-action (sign out → use different email)
        // rather than a 3-second toast.
        if (res.status === 409) {
          setConflictMessage(
            payload.error ||
              'You are already in another account. Entrar with a different email to join this one.',
          );
        } else {
          toast.error(payload.error || 'Falhou to accept invitation');
        }
        setAccepting(false);
        return;
      }
      toast.success('Welcome to the team');
      // Full reload (not router.push) so AuthProvider re-fetches
      // the profile with the new account_id and account_role.
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('[join] redeem error:', err);
      toast.error('Could not reach the server');
      setAccepting(false);
    }
  }, [token]);

  const handleSignOutAndRetry = useCallback(async () => {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
      // Hard reload so the new auth state propagates everywhere
      // (middleware, AuthProvider). Preserves the invite token in
      // the URL so the rebuilt page renders the signed-out CTA path.
      window.location.reload();
    } catch (err) {
      console.error('[join] sign-out error:', err);
      toast.error('Could not sign out. Try refreshing the page.');
      setSigningOut(false);
    }
  }, []);

  // ----- Loading state (peek pending OR auth not yet resolved) -----
  if (peek === null || authedUserId === undefined) {
    return (
      <Card classNome="w-full max-w-md border-slate-800 bg-slate-900">
        <CardContent classNome="flex flex-col items-center gap-3 py-12">
          <Loader2 classNome="size-6 animate-spin text-primary" />
          <p classNome="text-sm text-slate-400">Verificaring invitation…</p>
        </CardContent>
      </Card>
    );
  }

  // ----- Peek failed -----
  if (!peek.ok) {
    const copy = FAIL_COPY[peek.reason];
    return (
      <Card classNome="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader classNome="items-center text-center">
          <div classNome="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
            <MailX classNome="h-6 w-6 text-red-400" />
          </div>
          <CardTitle classNome="text-xl text-white">{copy.title}</CardTitle>
          <CardDescription classNome="text-slate-400">
            {copy.body}
          </CardDescription>
        </CardHeader>
        <CardContent classNome="flex flex-col gap-2">
          {/* For server_error the failure is transient — the network
              flapped or the peek endpoint hiccupped. Try-again is
              the right primary action; the "create account" /
              "sign in" links stay as secondary options. Other
              failure reasons (not_found / used / expired) are
              terminal for this token, so no retry — just the
              signup/sign-in escape hatches. */}
          {peek.reason === 'server_error' ? (
            <>
              <Button
                onClick={loadPeekAndAuth}
                classNome="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Tentar novamente
              </Button>
              <Link href="/signup">
                <Button
                  variant="outline"
                  classNome="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Criar a new account instead
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup">
                <Button classNome="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Criar a new account instead
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  classNome="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Entrar
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // ----- Peek OK -----
  const inviteHeader = (
    <CardHeader classNome="items-center text-center">
      <div classNome="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <UsersRound classNome="h-6 w-6 text-primary" />
      </div>
      <CardTitle classNome="text-xl text-white">
        You&apos;re invited to{' '}
        <span classNome="text-primary">{peek.account_name}</span>
      </CardTitle>
      <CardDescription classNome="text-slate-400">
        You&apos;ll join as{' '}
        <span classNome="inline-flex items-center gap-1 text-white">
          <ShieldCheck classNome="size-3.5 text-primary" />
          {ROLE_LABEL[peek.role]}
        </span>
        . Link valid until{' '}
        {new Date(peek.expires_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
        .
      </CardDescription>
    </CardHeader>
  );

  // ----- Authed: show Accept button -----
  if (authedUserId) {
    return (
      <>
        <Card classNome="w-full max-w-md border-slate-800 bg-slate-900">
          {inviteHeader}
          <CardContent classNome="flex flex-col gap-3">
            <Button
              onClick={handleAccept}
              disabled={accepting}
              classNome="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {accepting ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Accepting…
                </>
              ) : (
                <>
                  <CheckCircle classNome="size-4" />
                  Accept invitation
                </>
              )}
            </Button>
            <p classNome="text-center text-xs text-slate-500">
              Accepting moves your login into{' '}
              <span classNome="text-slate-400">{peek.account_name}</span>. Your
              empty personal account from signup will be cleaned up.
            </p>
          </CardContent>
        </Card>

        {/* Conflict modal — opens when the redeem endpoint returns 409
            (caller already in a shared account or has domain data).
            Blocks the flow until the user picks a recovery action so
            they aren't stuck retrying an inevitable failure. */}
        <Dialog
          open={conflictMessage !== null}
          onAbertoChange={(open) => {
            if (!open) setConflictMessage(null);
          }}
        >
          <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-md">
            <DialogHeader>
              <DialogTitle classNome="flex items-center gap-2 text-white">
                <AlertTriangle classNome="size-4 text-amber-400" />
                Can&apos;t join {peek.account_name} with this account
              </DialogTitle>
              <DialogDescription classNome="text-slate-400">
                {conflictMessage}
              </DialogDescription>
            </DialogHeader>
            <div classNome="space-y-2 py-2 text-xs text-slate-500">
              <p>
                To join{' '}
                <span classNome="text-slate-300">{peek.account_name}</span>,
                sign out and sign up again with a different email address.
                The invite link stays valid as long as it hasn&apos;t
                expired.
              </p>
            </div>
            <DialogFooter classNome="bg-slate-900 border-slate-700">
              <Button
                variant="outline"
                onClick={() => setConflictMessage(null)}
                classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Stay signed in
              </Button>
              <Button
                onClick={handleSignOutAndRetry}
                disabled={signingOut}
                classNome="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {signingOut ? (
                  <>
                    <Loader2 classNome="size-4 animate-spin" />
                    Signing out…
                  </>
                ) : (
                  'Sair & use a different email'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ----- Not authed: prompt to sign up or sign in -----
  return (
    <Card classNome="w-full max-w-md border-slate-800 bg-slate-900">
      {inviteHeader}
      <CardContent classNome="flex flex-col gap-2">
        <Link href={`/signup?invite=${encodeURIComponent(token!)}`}>
          <Button classNome="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Criar conta &amp; join
          </Button>
        </Link>
        <Link href={`/login?invite=${encodeURIComponent(token!)}`}>
          <Button
            variant="outline"
            classNome="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            I already have an account
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
