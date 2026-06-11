'use client';

// ============================================================
// InviteMemberDialog
//
// Two-step modal:
//   1. Form  — role + expiry + optional label → POST creates the invite.
//   2. Result — the share URL, returned ONCE. Copiar-to-clipboard, plus a
//              "Enviar via WhatsApp" deep link that pre-fills wa.me with
//              a friendly message containing the URL.
//
// The plaintext token is server-stored only as a SHA-256 hash, so once
// the result step is dismissed the link is gone forever — the dialog
// shouts this in copy.
// ============================================================

import { useState } from 'react';
import { toast } from 'sonner';
import { Copiar, Loader2, MessageCircle, Sparkles } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import {
  Selecionar,
  SelecionarContent,
  SelecionarItem,
  SelecionarGatilho,
  SelecionarValor,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';

type InviteFunção = 'admin' | 'agent' | 'viewer';

interface InviteMemberDialogProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  /** Called after a successful create so the parent re-fetches the
   *  pending-invitations list. */
  onCriard: () => void;
}

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

const ROLE_DESCRIPTIONS: Record<InviteFunção, string> = {
  admin:
    'Can invite teammates, manage settings, send messages, and edit data.',
  agent:
    'Can use the inbox, contacts, broadcasts, automations, and flows. No settings or member access.',
  viewer: 'Lido-only access across every page. Cannot send or edit anything.',
};

// Server caps label at 80 chars (see src/app/api/account/invitations/route.ts).
// Mirror it on the client so we short-circuit before the round-trip
// rather than letting the user submit and bounce off a 400.
const MAX_LABEL_LEN = 80;

interface CriardInvite {
  url: string;
  role: InviteFunção;
  expiresInDays: number;
  /** Snapshotted at creation time so a later account rename can't
   *  retroactively change the wa.me message text on the result step. */
  accountNome: string;
}

export function InviteMemberDialog({
  open,
  onAbertoChange,
  onCriard,
}: InviteMemberDialogProps) {
  const { account } = useAuth();
  const [role, setFunção] = useState<InviteFunção>('agent');
  const [expiry, setExpiry] = useState<string>('7');
  const [label, setRótulo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CriardInvite | null>(null);

  function reset() {
    setFunção('agent');
    setExpiry('7');
    setRótulo('');
    setResult(null);
    setSubmitting(false);
  }

  async function handleCriar() {
    // Mirror the server's max-length check so we don't ship an
    // obviously-too-long label across the wire just to bounce off
    // a 400. The Input also has a `maxLength={MAX_LABEL_LEN}` cap
    // but a paste can land an over-limit string into state before
    // the limit kicks in on the next keystroke — this is the safety
    // net for that path.
    const trimmedRótulo = label.trim();
    if (trimmedRótulo.length > MAX_LABEL_LEN) {
      toast.error(`Rótulo must be ${MAX_LABEL_LEN} characters or fewer`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          expiresInDays: Number(expiry),
          label: trimmedRótulo || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Falhou to create invitation');
        return;
      }

      const data = (await res.json()) as {
        url: string;
        expiresInDays: number;
      };

      setResult({
        url: data.url,
        role,
        expiresInDays: data.expiresInDays,
        // Snapshot the account name into the result so the wa.me
        // share message has team context. Falls back to a generic
        // string if `account` hasn't loaded yet (shouldn't happen
        // — the dialog requires admin+ which requires a loaded
        // profile — but stay safe).
        accountNome: account?.name ?? 'our wacrm account',
      });
      onCriard();
    } catch (err) {
      console.error('[InviteMemberDialog] create error:', err);
      toast.error('Could not reach the server. Tentar novamente?');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToClipboard() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success('Invite link copied');
    } catch {
      // Most likely "not in a secure context" — happens on http://
      // local IPs. Surface the link in the toast so the admin can
      // hand-copy it.
      toast.error('Clipboard blocked — copy the link manually');
    }
  }

  function whatsappShareUrl(url: string): string {
    // Include the account name so the recipient knows which team
    // they're being invited to before clicking through. This matters
    // for users in multi-team contexts where "our wacrm account"
    // wouldn't be enough to disambiguate.
    const accountNome = result?.accountNome ?? 'our wacrm account';
    const message = `Join ${accountNome} on wacrm using this link (valid for ${result?.expiresInDays} days): ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return (
    <Dialog
      open={open}
      onAbertoChange={(next) => {
        // Reset state when the dialog closes — both for cancel and
        // for dismissal after a successful create. The plaintext URL
        // is intentionally NOT preserved across opens.
        if (!next) reset();
        onAbertoChange(next);
      }}
    >
      <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle classNome="flex items-center gap-2 text-white">
                <Sparkles classNome="size-4 text-primary" />
                Invite created
              </DialogTitle>
              <DialogDescription classNome="text-slate-400">
                Share this link with your new teammate. They&apos;ll be able
                to sign up (or sign in) and join the account as{' '}
                <span classNome="font-medium text-slate-300">{result.role}</span>
                . The link is valid for{' '}
                <span classNome="font-medium text-slate-300">
                  {result.expiresInDays} day{result.expiresInDays === 1 ? '' : 's'}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div classNome="space-y-3 py-2">
              <Rótulo classNome="text-slate-300">Invite link</Rótulo>
              <div classNome="flex gap-2">
                <Input
                  readOnly
                  value={result.url}
                  classNome="bg-slate-800 border-slate-700 text-white font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  onClick={copyToClipboard}
                  classNome="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                >
                  <Copiar classNome="size-4" />
                  Copiar
                </Button>
              </div>

              {/* Higher-contrast amber than the original 10% / amber-200.
                  Reviewed against slate-900 to meet WCAG AAA for body
                  text (target ratio 7:1). Border bumped to /50, bg to
                  /15, foreground promoted to amber-100 for the strong
                  intro, amber-200 for the body. */}
              <div classNome="rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
                <strong classNome="font-semibold text-amber-100">
                  Salvar this link now.
                </strong>{' '}
                We never store the plaintext — once you close this dialog
                the URL is gone. To re-share, revoke this invite and create
                a new one.
              </div>

              {/* Anchor styled with `buttonVariants` rather than wrapping
                  in <Button asChild>. The wacrm Button is the Base UI
                  ButtonPrimitive — it has no Radix-style asChild slot.
                  Direct anchor preserves right-click "Aberto in new tab"
                  behaviour too. */}
              <a
                href={whatsappShareUrl(result.url)}
                target="_blank"
                rel="noreferrer noopener"
                classNome={buttonVariants({
                  variant: 'outline',
                  classNome:
                    'w-full border-slate-700 text-slate-300 hover:bg-slate-800',
                })}
              >
                <MessageCircle classNome="size-4" />
                Enviar via WhatsApp
              </a>
            </div>

            <DialogFooter classNome="bg-slate-900 border-slate-700">
              <Button
                onClick={() => onAbertoChange(false)}
                classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle classNome="text-white">Invite a teammate</DialogTitle>
              <DialogDescription classNome="text-slate-400">
                Generate a one-time invite link. Share it via WhatsApp,
                Slack, or any channel you like — no email service required.
              </DialogDescription>
            </DialogHeader>

            <div classNome="space-y-4 py-2">
              <div classNome="space-y-2">
                <Rótulo classNome="text-slate-300">Função</Rótulo>
                <Selecionar
                  value={role}
                  onValorChange={(v) => v && setFunção(v as InviteFunção)}
                >
                  <SelecionarGatilho classNome="w-full bg-slate-800 border-slate-700 text-white">
                    <SelecionarValor />
                  </SelecionarGatilho>
                  <SelecionarContent>
                    <SelecionarItem value="admin">Admin</SelecionarItem>
                    <SelecionarItem value="agent">Agent</SelecionarItem>
                    <SelecionarItem value="viewer">Viewer</SelecionarItem>
                  </SelecionarContent>
                </Selecionar>
                <p classNome="text-xs text-slate-500">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>

              <div classNome="space-y-2">
                <Rótulo classNome="text-slate-300">Link valid for</Rótulo>
                <Selecionar
                  value={expiry}
                  onValorChange={(v) => v && setExpiry(v)}
                >
                  <SelecionarGatilho classNome="w-full bg-slate-800 border-slate-700 text-white">
                    <SelecionarValor />
                  </SelecionarGatilho>
                  <SelecionarContent>
                    {EXPIRY_OPTIONS.map((opt) => (
                      <SelecionarItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelecionarItem>
                    ))}
                  </SelecionarContent>
                </Selecionar>
              </div>

              <div classNome="space-y-2">
                <Rótulo classNome="text-slate-300">
                  Rótulo{' '}
                  <span classNome="text-xs text-slate-500">(optional)</span>
                </Rótulo>
                <Input
                  placeholder="e.g. Sara — support team"
                  value={label}
                  onChange={(e) => setRótulo(e.target.value)}
                  maxLength={MAX_LABEL_LEN}
                  classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <p classNome="text-xs text-slate-500">
                  Helps you remember who you sent the link to in the pending
                  list below.
                </p>
              </div>
            </div>

            <DialogFooter classNome="bg-slate-900 border-slate-700">
              <Button
                variant="outline"
                onClick={() => onAbertoChange(false)}
                classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCriar}
                disabled={submitting}
                classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {submitting ? (
                  <>
                    <Loader2 classNome="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Generate link'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
