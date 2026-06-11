'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copiar,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionGatilho,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConectarionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const supabase = createClient();
  // After multi-user, whatsapp_config is one-row-per-account, not
  // one-row-per-user. We pull `accountId` straight off the auth
  // context and key every read off it — so a teammate who just
  // joined an account sees the inviter's saved config without
  // having to re-enter anything.
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConectarionStatus] = useState<ConectarionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [phoneNumberId, setTelefoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerificarToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEditared, setTokenEditared] = useState(false);

  // True once /register has succeeded on Meta's side (timestamp set
  // in the row). When false, the saved config is metadata-only and
  // Meta will silently drop every inbound event — that's the
  // multi-number bug that prompted this work.
  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationErro = config?.last_registration_error ?? null;

  const [verifyingRegistration, setVerificaringRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] =
    useState<RegistrationProbe | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (acctId: string) => {
    setLoading(true);
    try {
      // Load form values from Supabase (shows what's in DB).
      // Switched from `user_id` (which would only match the row's
      // original author) to `account_id` so every member of the
      // account sees the same saved configuration. UNIQUE(account_id)
      // on the table guarantees the .maybeSingle() return type
      // remains accurate.
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', acctId)
        .maybeSingle();

      if (error) {
        console.error('Falhou to load config row:', error);
      }

      if (data) {
        setConfig(data);
        setTelefoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerificarToken('');
        setPin('');
        setTokenEditared(false);
      } else {
        setConfig(null);
        setTelefoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerificarToken('');
        setPin('');
        setTokenEditared(false);
      }
      // Clear any stale probe result when reloading the row.
      setRegistrationProbe(null);

      // Then verify health via the API (decrypts token + pings Meta)
      if (data) {
        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();

          if (payload.connected) {
            setConectarionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConectarionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
            setStatusMessage(payload.message || '');
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConectarionStatus('disconnected');
        }
      } else {
        setConectarionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Falhou to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Need both the auth session (`!authLoading`) AND the profile
    // (`!profileLoading`, which carries `accountId`). Without the
    // second guard, the effect would fire with `accountId === null`
    // for the first render window and bail without ever retrying
    // once the profile arrives.
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  async function handleSalvar() {
    if (!phoneNumberId.trim()) {
      toast.error('Telefone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEditared)) {
      toast.error('Token de Acesso is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      // Always POST through the API — it verifies with Meta and encrypts
      // the access_token server-side with ENCRYPTION_KEY. Skipping this
      // and writing direct to Supabase stores the token in plaintext,
      // which then fails decryption on every subsequent health check.
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        // Opcional — only sent when the user filled it in. The server
        // requires it on first save or when changing numbers; for a
        // simple token rotation, leaving it blank skips re-register.
        pin: pin.trim() || null,
      };

      if (tokenEditared && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        // Existing config — reuse stored encrypted token by decrypting on the
        // server. But our POST handler requires an access_token to verify
        // with Meta. If the user didn't change the token, we need to signal
        // that. Simplest: require token re-entry if they're updating.
        toast.error('Please re-enter the Token de Acesso to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Falhou to save configuration');
        setSaving(false);
        return;
      }

      // The route now returns a structured outcome:
      //   * registered=true   → number is live, events will flow
      //   * registered=false  → credentials saved but /register
      //                         failed; UI shows the specific error
      //                         and a retry path. registration_error
      //                         is human-readable from Meta.
      if (data.registered === false && data.registration_error) {
        toast.error(
          `Salvard, but Meta couldn't register the number: ${data.registration_error}`,
          { duration: 12000 },
        );
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? `Live — ${data.phone_info.verified_name} can now receive events.`
            : 'WhatsApp connected. Events will start flowing within a minute.',
        );
        // Clear the PIN so subsequent saves don't accidentally
        // re-register (which would void the active subscription if
        // the PIN became stale).
        setPin('');
      }

      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Salvar error:', err);
      toast.error('Falhou to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConectarion() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConectarionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Conectared to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConectarionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Testar conexão error:', err);
      setConectarionStatus('disconnected');
      toast.error('Conectarion test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleVerificarRegistration() {
    setVerificaringRegistration(true);
    setRegistrationProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration', {
        method: 'GET',
      });
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success('Number is fully wired — Meta is delivering events.');
      } else {
        toast.error(
          'Number is not fully registered. See the checks below for which step failed.',
          { duration: 8000 },
        );
      }
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error('Could not reach the verification endpoint.');
    } finally {
      setVerificaringRegistration(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Falhou to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setConfig(null);
      setTelefoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerificarToken('');
      setTokenEditared(false);
      setConectarionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Falhou to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopiarWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL do Webhook copied to clipboard');
  }

  if (loading) {
    return (
      <div classNome="flex items-center justify-center py-12">
        <Loader2 classNome="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  return (
    <div classNome="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main config form */}
      <div classNome="space-y-6">
        {/* Corrupted-token reset banner */}
        {showResetBanner && (
          <Alert classNome="bg-amber-950/40 border-amber-600/40">
            <div classNome="flex items-start gap-3">
              <AlertTriangle classNome="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div classNome="flex-1">
                <AlertTitle classNome="text-amber-200 mb-1">
                  Stored token can&apos;t be decrypted
                </AlertTitle>
                <AlertDescription classNome="text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  classNome="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetting ? (
                    <>
                      <Loader2 classNome="size-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw classNome="size-4" />
                      Reset Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Conectarion Status */}
        <Alert classNome="bg-slate-900 border-slate-700">
          <div classNome="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 classNome="size-4 text-primary" />
            ) : (
              <XCircle classNome="size-4 text-red-500" />
            )}
            <AlertTitle classNome="text-white mb-0">
              {connectionStatus === 'connected' ? 'Credentials valid' : 'Not Conectared'}
            </AlertTitle>
          </div>
          <AlertDescription classNome="text-slate-400">
            {connectionStatus === 'connected'
              ? 'Your access token authenticates with Meta. See Registration status below for whether webhooks are actually wired.'
              : statusMessage ||
                'Configure your Meta API credentials below to connect your WhatsApp Business account.'}
          </AlertDescription>
        </Alert>

        {/* Registration Status — the "is it actually live?" check.
            Credentials being valid is necessary but not sufficient;
            without a successful /register call the number won't
            receive inbound events. Surface this dimension separately
            so users don't trust a misleading green banner. */}
        {config && (
          <Alert
            classNome={
              isRegistered
                ? 'bg-emerald-950/30 border-emerald-700/50'
                : 'bg-amber-950/30 border-amber-700/50'
            }
          >
            <div classNome="flex items-center justify-between gap-2 flex-wrap">
              <div classNome="flex items-center gap-2">
                {isRegistered ? (
                  <CheckCircle2 classNome="size-4 text-emerald-400" />
                ) : (
                  <AlertTriangle classNome="size-4 text-amber-400" />
                )}
                <AlertTitle
                  classNome={
                    'mb-0 ' + (isRegistered ? 'text-emerald-200' : 'text-amber-200')
                  }
                >
                  {isRegistered
                    ? 'Registered — Meta will deliver events to wacrm'
                    : 'Not registered — Meta will not deliver events'}
                </AlertTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerificarRegistration}
                disabled={verifyingRegistration}
                classNome="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 h-7"
              >
                {verifyingRegistration ? (
                  <Loader2 classNome="size-3.5 animate-spin" />
                ) : (
                  <Zap classNome="size-3.5" />
                )}
                Verificar with Meta
              </Button>
            </div>
            <AlertDescription classNome="text-slate-400 mt-2 text-xs leading-relaxed">
              {isRegistered ? (
                <>
                  Subscribed since{' '}
                  {config.registered_at
                    ? new Date(config.registered_at).toLocaleString()
                    : 'unknown'}
                  . Click <strong>Verificar with Meta</strong> if events
                  stop arriving.
                </>
              ) : lastRegistrationErro ? (
                <>
                  Last attempt failed with:{' '}
                  <span classNome="text-red-300">
                    &quot;{lastRegistrationErro}&quot;
                  </span>
                  . Enter (or correct) the 2-step PIN below and click
                  Salvar Configuration to retry.
                </>
              ) : (
                <>
                  This number was saved before registration tracking
                  existed, or registration was skipped. Enter the
                  2-step PIN below and click Salvar Configuration to
                  subscribe it.
                </>
              )}
            </AlertDescription>

            {registrationProbe && (
              <div classNome="mt-3 rounded border border-slate-700 bg-slate-900/60 px-3 py-2 space-y-1.5 text-[11px]">
                <p classNome="font-medium text-slate-200">
                  Diagnostic — last run: {' '}
                  <span classNome={registrationProbe.live ? 'text-emerald-400' : 'text-amber-400'}>
                    {registrationProbe.live ? 'live' : 'not live'}
                  </span>
                </p>
                <ul classNome="space-y-0.5 text-slate-400">
                  {Object.entries(registrationProbe.checks).map(([k, v]) => (
                    <li key={k} classNome="flex items-center gap-1.5">
                      {v === true ? (
                        <CheckCircle2 classNome="size-3 text-emerald-400 shrink-0" />
                      ) : v === false ? (
                        <XCircle classNome="size-3 text-red-400 shrink-0" />
                      ) : (
                        <span classNome="size-3 rounded-full border border-slate-600 shrink-0" />
                      )}
                      <code classNome="text-slate-300">{k}</code>
                    </li>
                  ))}
                </ul>
                {(registrationProbe.errors ?? []).length > 0 && (
                  <ul classNome="pt-1 space-y-0.5 text-red-300">
                    {registrationProbe.errors?.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Alert>
        )}

        {/* API Credentials */}
        <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle classNome="text-white">API Credentials</CardTitle>
            <CardDescription classNome="text-slate-400">
              Enter your Meta WhatsApp Business API credentials.
            </CardDescription>
          </CardHeader>
          <CardContent classNome="space-y-4">
            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Telefone Number ID</Rótulo>
              <Input
                placeholder="e.g. 100234567890123"
                value={phoneNumberId}
                onChange={(e) => setTelefoneNumberId(e.target.value)}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">ID da Conta Business WhatsApp</Rótulo>
              <Input
                placeholder="e.g. 100234567890456"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Permanent Token de Acesso</Rótulo>
              <div classNome="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your access token"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value);
                    setTokenEditared(true);
                  }}
                  onFocus={() => {
                    if (accessToken === MASKED_TOKEN) {
                      setAccessToken('');
                      setTokenEditared(true);
                    }
                  }}
                  classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  classNome="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showToken ? <EyeOff classNome="size-4" /> : <Eye classNome="size-4" />}
                </button>
              </div>
              {config && !tokenEditared && (
                <p classNome="text-xs text-slate-500">
                  Token is hidden for security. Re-enter it to update configuration.
                </p>
              )}
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Webhook Verificar Token</Rótulo>
              <Input
                placeholder="Criar a custom verify token"
                value={verifyToken}
                onChange={(e) => setVerificarToken(e.target.value)}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p classNome="text-xs text-slate-500">
                A custom string you create. Must match the token you set in Meta webhook settings.
              </p>
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">
                Two-step verification PIN
                {!isRegistered && (
                  <span classNome="ml-1 text-red-400">*</span>
                )}
              </Rótulo>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit PIN from Meta WhatsApp Manager"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 tracking-widest"
              />
              <p classNome="text-xs text-slate-500 leading-relaxed">
                Obrigatório the first time you connect a number, and any
                time you swap to a different number. Set it in{' '}
                <strong classNome="text-slate-300">
                  Meta Business Manager → WhatsApp Accounts → Telefone
                  Numbers → Two-step verification
                </strong>
                . Without this PIN, Meta saves your credentials but
                won&apos;t actually route inbound messages to wacrm —
                the symptom that hits second numbers under a shared
                WABA. Leave blank to keep an existing registration
                untouched.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* URL do Webhook */}
        <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle classNome="text-white">Webhook Configuration</CardTitle>
            <CardDescription classNome="text-slate-400">
              Use this URL as your webhook callback in the Meta App Painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Webhook Callback URL</Rótulo>
              <div classNome="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  classNome="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopiarWebhookUrl}
                  classNome="shrink-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Copiar classNome="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ação Buttons */}
        <div classNome="flex flex-wrap gap-3">
          <Button
            onClick={handleSalvar}
            disabled={saving}
            classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 classNome="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuration'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConectarion}
            disabled={testing || !config}
            classNome="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            {testing ? (
              <>
                <Loader2 classNome="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap classNome="size-4" />
                Test API Conectarion
              </>
            )}
          </Button>
          {config && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              classNome="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw classNome="size-4" />
                  Reset Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle classNome="text-white text-base">Setup Instructions</CardTitle>
            <CardDescription classNome="text-slate-400">
              Follow these steps to connect your WhatsApp Business API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem classNome="border-slate-700">
                <AccordionGatilho classNome="text-slate-300 hover:text-white hover:no-underline">
                  <span classNome="flex items-center gap-2">
                    <span classNome="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    Criar a Meta App
                  </span>
                </AccordionGatilho>
                <AccordionContent classNome="text-slate-400">
                  <ol classNome="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to <span classNome="text-primary">developers.facebook.com</span></li>
                    <li>Click &quot;My Apps&quot; and then &quot;Criar App&quot;</li>
                    <li>Selecionar &quot;Business&quot; as the app type</li>
                    <li>Fill in app details and create</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem classNome="border-slate-700">
                <AccordionGatilho classNome="text-slate-300 hover:text-white hover:no-underline">
                  <span classNome="flex items-center gap-2">
                    <span classNome="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    Adicionar WhatsApp Product
                  </span>
                </AccordionGatilho>
                <AccordionContent classNome="text-slate-400">
                  <ol classNome="list-decimal list-inside space-y-1 text-sm">
                    <li>In your app dashboard, click &quot;Adicionar Product&quot;</li>
                    <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                    <li>Follow the setup wizard to link your business</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem classNome="border-slate-700">
                <AccordionGatilho classNome="text-slate-300 hover:text-white hover:no-underline">
                  <span classNome="flex items-center gap-2">
                    <span classNome="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    Get API Credentials
                  </span>
                </AccordionGatilho>
                <AccordionContent classNome="text-slate-400">
                  <ol classNome="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to WhatsApp &gt; API Setup</li>
                    <li>Copiar your <strong classNome="text-slate-200">Telefone Number ID</strong></li>
                    <li>Copiar your <strong classNome="text-slate-200">ID da Conta Business WhatsApp</strong></li>
                    <li>Generate a <strong classNome="text-slate-200">Permanent Token de Acesso</strong> from Business Settings &gt; Sistema Users</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem classNome="border-slate-700">
                <AccordionGatilho classNome="text-slate-300 hover:text-white hover:no-underline">
                  <span classNome="flex items-center gap-2">
                    <span classNome="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                    Configure Webhooks
                  </span>
                </AccordionGatilho>
                <AccordionContent classNome="text-slate-400">
                  <ol classNome="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to WhatsApp &gt; Configuration</li>
                    <li>Click &quot;Editar&quot; on the Webhook section</li>
                    <li>Paste the <strong classNome="text-slate-200">Webhook Callback URL</strong> from above</li>
                    <li>Enter the same <strong classNome="text-slate-200">Verificar Token</strong> you set here</li>
                    <li>Subscribe to &quot;messages&quot; webhook field</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div classNome="mt-4 pt-4 border-t border-slate-700">
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                classNome="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink classNome="size-3.5" />
                Meta WhatsApp API Documentation
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
