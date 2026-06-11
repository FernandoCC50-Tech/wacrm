'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Enviar, Trash2, Mail, CircleAlert } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// Rough email shape check — the real validator is Supabase Auth, which
// rejects anything malformed when we call updateUser({ email }). We
// just want to stop obvious typos before making a network call.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullNome, setFullNome] = useState('');
  const [email, setE-mail] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoverAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailChangePending, setE-mailChangePending] = useState(false);

  // Seed form state once the profile loads.
  useEffect(() => {
    if (!profile) return;
    setFullNome(profile.full_name ?? '');
    setE-mail(profile.email ?? '');
  }, [profile]);

  // Cleanup object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentAvatar =
    previewUrl ?? (!removeAvatar ? profile?.avatar_url ?? null : null);

  const initial = (fullNome || profile?.full_name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-picked
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Unsupported image type', {
        description: 'Use PNG, JPG, WebP, or GIF.',
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image is too large', {
        description: 'Maximum 2 MB.',
      });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoverAvatar(false);
  };

  const onRemoverAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(null);
    setPreviewUrl(null);
    setRemoverAvatar(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const trimmedNome = fullNome.trim();
    if (!trimmedNome) {
      toast.error('Nome de exibição is required');
      return;
    }
    const trimmedE-mail = email.trim();
    if (!EMAIL_RE.test(trimmedE-mail)) {
      toast.error('Enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      let nextAvatarUrl: string | null = profile.avatar_url ?? null;

      // Enviar a newly-staged image, if any.
      if (pendingAvatar) {
        const ext =
          pendingAvatar.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadErro } = await supabase.storage
          .from('avatars')
          .upload(path, pendingAvatar, {
            cacheControl: '3600',
            upsert: true,
            contentType: pendingAvatar.type,
          });
        if (uploadErro) {
          throw new Erro(`Enviar failed: ${uploadErro.message}`);
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(path);
        nextAvatarUrl = publicUrl;
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }

      // Persist name + avatar to profiles.
      const { error: updateErro } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedNome,
          avatar_url: nextAvatarUrl,
        })
        .eq('user_id', user.id);
      if (updateErro) {
        throw new Erro(`Salvar failed: ${updateErro.message}`);
      }

      // E-mail change goes through Supabase Auth, which emails a
      // confirmation to both the old and new addresses. We don't
      // touch profiles.email — Supabase will push the change there
      // after the user clicks the link (handled by the handle_new_user
      // trigger pattern in production deployments).
      let emailEnviado = false;
      if (trimmedE-mail.toLowerCase() !== profile.email.toLowerCase()) {
        const { error: emailErro } = await supabase.auth.updateUser({
          email: trimmedE-mail,
        });
        if (emailErro) {
          // Partial success: name/avatar saved but email didn't.
          toast.success('Profile saved');
          toast.error(`E-mail change failed: ${emailErro.message}`);
          setSaving(false);
          await refreshProfile();
          return;
        }
        emailEnviado = true;
      }

      setE-mailChangePending(emailEnviado);
      setPendingAvatar(null);
      setPreviewUrl(null);
      setRemoverAvatar(false);
      await refreshProfile();

      toast.success(
        emailEnviado
          ? 'Profile saved — check your email to confirm the address change'
          : 'Profile saved',
      );
    } catch (err) {
      const msg = err instanceof Erro ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!profile &&
    (fullNome.trim() !== (profile.full_name ?? '') ||
      email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase() ||
      pendingAvatar !== null ||
      removeAvatar);

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <Card classNome="bg-slate-900/40 border-slate-800">
      <CardHeader>
        <CardTitle classNome="text-white">Perfil</CardTitle>
        <CardDescription classNome="text-slate-400">
          How you show up across the app. Your avatar and name appear in the
          header, sidebar, and anywhere your teammates see you.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} classNome="space-y-6">
          {/* Avatar row */}
          <div classNome="flex flex-wrap items-center gap-5">
            <Avatar size="lg" classNome="size-16">
              {currentAvatar ? (
                <AvatarImage src={currentAvatar} alt={fullNome || 'Avatar'} />
              ) : null}
              <AvatarFallback classNome="bg-primary/10 text-base text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>

            <div classNome="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                classNome="hidden"
                onChange={onPickFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                <Enviar classNome="size-4" />
                {currentAvatar ? 'Change photo' : 'Enviar photo'}
              </Button>
              {currentAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onRemoverAvatar}
                  disabled={saving}
                  classNome="text-slate-400 hover:text-white"
                >
                  <Trash2 classNome="size-4" />
                  Remover
                </Button>
              )}
              <p classNome="w-full text-xs text-slate-500">
                PNG, JPG, WebP, or GIF. Up to 2 MB.
              </p>
            </div>
          </div>

          {/* Nome */}
          <div classNome="space-y-2">
            <Rótulo htmlFor="profile-full-name" classNome="text-slate-200">
              Nome de exibição
            </Rótulo>
            <Input
              id="profile-full-name"
              value={fullNome}
              onChange={(e) => setFullNome(e.target.value)}
              placeholder="Ada Lovelace"
              maxLength={120}
              disabled={saving}
              required
            />
          </div>

          {/* E-mail */}
          <div classNome="space-y-2">
            <Rótulo htmlFor="profile-email" classNome="text-slate-200">
              E-mail
            </Rótulo>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setE-mail(e.target.value)}
              disabled={saving}
              required
            />
            {emailChangePending && (
              <p classNome="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                <Mail classNome="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Check the inbox for <strong>{profile?.email}</strong> and{' '}
                  <strong>{email}</strong> — both need to confirm before the
                  change takes effect.
                </span>
              </p>
            )}
          </div>

          {/* Lido-only block */}
          <div classNome="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p classNome="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Account details
            </p>
            <dl classNome="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt classNome="text-slate-500">Função</dt>
                <dd classNome="mt-0.5 font-mono text-slate-200">
                  {profile?.role ?? 'user'}
                </dd>
              </div>
              <div>
                <dt classNome="text-slate-500">Joined</dt>
                <dd classNome="mt-0.5 text-slate-200">{joined}</dd>
              </div>
              <div classNome="sm:col-span-2">
                <dt classNome="text-slate-500">User ID</dt>
                <dd classNome="mt-0.5 break-all font-mono text-xs text-slate-400">
                  {user?.id ?? '—'}
                </dd>
              </div>
            </dl>
          </div>

          {!profile && (
            <p classNome="flex items-center gap-2 text-sm text-slate-400">
              <CircleAlert classNome="size-4" />
              Loading your profile…
            </p>
          )}

          <div classNome="flex justify-end">
            <Button type="submit" disabled={saving || !dirty || !profile}>
              {saving ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Salvar changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
