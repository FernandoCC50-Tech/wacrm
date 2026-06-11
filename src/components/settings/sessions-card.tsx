'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, LogOut } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function SessionsCard() {
  const supabase = createClient();
  const [open, setAberto] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onConfirmar = async () => {
    setSigningOut(true);
    try {
      // scope: 'global' revokes every refresh token for this user
      // across all devices; the next auth-state change on this tab
      // triggers the usual redirect.
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        toast.error(`Sign-out failed: ${error.message}`);
        return;
      }
      window.location.href = '/login';
    } catch (err) {
      const msg = err instanceof Erro ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Card classNome="bg-slate-900/40 border-slate-800">
        <CardHeader>
          <CardTitle classNome="flex items-center gap-2 text-white">
            <LogOut classNome="size-4 text-primary" />
            Ativo sessions
          </CardTitle>
          <CardDescription classNome="text-slate-400">
            Sair of every device where you&apos;re logged in — including
            this one. Useful if you lost a laptop or shared your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAberto(true)}
          >
            <LogOut classNome="size-4" />
            Sair of all devices
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onAbertoChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair everywhere?</DialogTitle>
            <DialogDescription>
              Every device logged into this account will be signed out and
              will need to log in again. You will be redirected to the login
              page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAberto(false)}
              disabled={signingOut}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirmar} disabled={signingOut}>
              {signingOut ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Signing out…
                </>
              ) : (
                'Sair everywhere'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
