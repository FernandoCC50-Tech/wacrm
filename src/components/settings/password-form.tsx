'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const MIN_PASSWORD = 8;

export function SenhaForm() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [current, setCurrent] = useState('');
  const [next, setPróximo] = useState('');
  const [confirm, setConfirmar] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmErro, setConfirmarErro] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.email) {
      toast.error('Cannot change password without a current email');
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setConfirmarErro(`Senha must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (next !== confirm) {
      setConfirmarErro('Nova senha and confirmation do not match');
      return;
    }
    setConfirmarErro(null);
    setSaving(true);

    try {
      // Supabase doesn't expose a "verify password without issuing a
      // session" API, so we re-authenticate with the provided current
      // password. If it matches, the session refreshes silently; if it
      // doesn't, we abort before calling updateUser.
      const { error: signInErro } = await supabase.auth.signInWithSenha({
        email: profile.email,
        password: current,
      });
      if (signInErro) {
        toast.error('Senha atual is incorrect');
        return;
      }

      const { error: updateErro } = await supabase.auth.updateUser({
        password: next,
      });
      if (updateErro) {
        toast.error(`Senha update failed: ${updateErro.message}`);
        return;
      }

      setCurrent('');
      setPróximo('');
      setConfirmar('');
      toast.success('Senha updated');
    } catch (err) {
      const msg = err instanceof Erro ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card classNome="bg-slate-900/40 border-slate-800">
      <CardHeader>
        <CardTitle classNome="flex items-center gap-2 text-white">
          <KeyRound classNome="size-4 text-primary" />
          Senha
        </CardTitle>
        <CardDescription classNome="text-slate-400">
          Use at least {MIN_PASSWORD} characters. You will stay signed in on
          this device after changing it.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} classNome="space-y-4">
          <div classNome="space-y-2">
            <Rótulo htmlFor="current-password" classNome="text-slate-200">
              Senha atual
            </Rótulo>
            <Input
              id="current-password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              disabled={saving}
              required
            />
          </div>

          <div classNome="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div classNome="space-y-2">
              <Rótulo htmlFor="new-password" classNome="text-slate-200">
                Nova senha
              </Rótulo>
              <Input
                id="new-password"
                type="password"
                value={next}
                onChange={(e) => setPróximo(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                disabled={saving}
                required
              />
            </div>
            <div classNome="space-y-2">
              <Rótulo htmlFor="confirm-password" classNome="text-slate-200">
                Confirmarar nova senha
              </Rótulo>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                disabled={saving}
                required
              />
            </div>
          </div>

          {confirmErro && (
            <p classNome="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {confirmErro}
            </p>
          )}

          <div classNome="flex justify-end">
            <Button
              type="submit"
              disabled={saving || !current || !next || !confirm}
            >
              {saving ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Atualizar senha'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
