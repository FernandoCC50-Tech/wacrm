'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Loader2,
  AtualizarCw,
  AlertCircle,
  X,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Selecionar,
  SelecionarContent,
  SelecionarItem,
  SelecionarGatilho,
  SelecionarValor,
} from '@/components/ui/select';
import type {
  MessageModelo,
  ModeloButton,
  ModeloSampleValors,
} from '@/types';
import { templateStatusConfig } from '@/lib/template-status';
import {
  extractVariableIndices,
  TEMPLATE_LIMITS,
} from '@/lib/whatsapp/template-validators';

const CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;
type HeaderFormat = 'none' | 'text' | 'image' | 'video' | 'document';
const HEADER_FORMATS: HeaderFormat[] = ['none', 'text', 'image', 'video', 'document'];

const categoryCors: Record<string, string> = {
  Marketing: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  Utility: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  Authentication: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
};

interface ModeloFormData {
  name: string;
  category: MessageModelo['category'];
  language: string;
  header_format: HeaderFormat;
  header_content: string;
  header_media_url: string;
  header_sample: string;
  body_text: string;
  body_samples: string[];
  footer_text: string;
  buttons: ModeloButton[];
}

const emptyForm: ModeloFormData = {
  name: '',
  category: 'Marketing',
  language: 'en_US',
  header_format: 'none',
  header_content: '',
  header_media_url: '',
  header_sample: '',
  body_text: '',
  body_samples: [],
  footer_text: '',
  buttons: [],
};

const COMMON_LANGUAGE_CODES = [
  'en_US',
  'en_GB',
  'en',
  'es',
  'es_ES',
  'es_MX',
  'fr',
  'fr_FR',
  'de',
  'it',
  'pt_BR',
  'pt_PT',
  'nl',
  'pl',
  'ru',
  'tr',
  'lt',
];

function emptyButton(type: ModeloButton['type']): ModeloButton {
  switch (type) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: '' };
    case 'URL':
      return { type: 'URL', text: '', url: '' };
    case 'PHONE_NUMBER':
      return { type: 'PHONE_NUMBER', text: '', phone_number: '' };
    case 'COPY_CODE':
      return { type: 'COPY_CODE', text: '', example: '' };
  }
}

export function ModeloManager() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [templates, setModelos] = useState<MessageModelo[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState<ModeloFormData>(emptyForm);
  // Non-null when the dialog is editing an existing row — switches the
  // submit handler from POST /submit to PATCH /[id] and changes the
  // dialog title + CTA. Set to the template id to pre-fill from a row.
  const [editingId, setEditaringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Modelo selected for the confirm-delete dialog. The destructive
  // action goes through this two-step so a slip on the trash icon
  // doesn't take the template off Meta as well as locally.
  const [templateToExcluir, setModeloToExcluir] =
    useState<MessageModelo | null>(null);

  // Body variable indices — `[1, 2, 3]` for "{{1}} {{2}} {{3}}". We
  // re-run the extractor on every render to keep the sample-value rows
  // in sync with what the user typed.
  const bodyVarCount = useMemo(
    () => extractVariableIndices(form.body_text).length,
    [form.body_text],
  );
  const headerVarCount = useMemo(
    () =>
      form.header_format === 'text'
        ? extractVariableIndices(form.header_content).length
        : 0,
    [form.header_format, form.header_content],
  );

  // Resize body_samples so it always has exactly bodyVarCount entries.
  // (We mutate via setForm in an effect so React owns the state.)
  useEffect(() => {
    setForm((prev) => {
      if (prev.body_samples.length === bodyVarCount) return prev;
      const next = prev.body_samples.slice(0, bodyVarCount);
      while (next.length < bodyVarCount) next.push('');
      return { ...prev, body_samples: next };
    });
  }, [bodyVarCount]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchModelos(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchModelos(userId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setModelos(data || []);
    } catch (err) {
      console.error('Falhou to fetch templates:', err);
      toast.error('Falhou to load templates');
    } finally {
      setLoading(false);
    }
  }

  function buildSubmitPayload() {
    const sample_values: ModeloSampleValors = {};
    if (form.body_samples.some((v) => v.trim())) {
      sample_values.body = form.body_samples.map((v) => v.trim());
    }
    if (form.header_format === 'text' && form.header_sample.trim()) {
      sample_values.header = [form.header_sample.trim()];
    }

    return {
      name: form.name.trim(),
      category: form.category,
      language: form.language.trim() || 'en_US',
      header_type: form.header_format === 'none' ? undefined : form.header_format,
      header_content:
        form.header_format === 'text' ? form.header_content.trim() : undefined,
      header_media_url:
        form.header_format !== 'none' && form.header_format !== 'text'
          ? form.header_media_url.trim() || undefined
          : undefined,
      body_text: form.body_text.trim(),
      footer_text: form.footer_text.trim() || undefined,
      buttons: form.buttons.length > 0 ? form.buttons : undefined,
      sample_values:
        Object.keys(sample_values).length > 0 ? sample_values : undefined,
    };
  }

  function openEditar(template: MessageModelo) {
    setEditaringId(template.id);
    setForm({
      name: template.name,
      category: template.category,
      language: template.language || 'en_US',
      header_format: (template.header_type ?? 'none') as HeaderFormat,
      header_content: template.header_content ?? '',
      header_media_url: template.header_media_url ?? '',
      header_sample: template.sample_values?.header?.[0] ?? '',
      body_text: template.body_text,
      body_samples: template.sample_values?.body ?? [],
      footer_text: template.footer_text ?? '',
      buttons: template.buttons ?? [],
    });
    setDialogAberto(true);
  }

  function openCriar() {
    setEditaringId(null);
    setForm(emptyForm);
    setDialogAberto(true);
  }

  async function handleSubmit() {
    // AUTHENTICATION is blocked by the persistent banner + disabled
    // submit button; this is a defensive second line of defense.
    if (form.category === 'Authentication') return;
    try {
      setSubmitting(true);
      const isEditar = editingId !== null;
      const url = isEditar
        ? `/api/whatsapp/templates/${editingId}`
        : '/api/whatsapp/templates/submit';
      const res = await fetch(url, {
        method: isEditar ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Erro(
          data?.error || `${isEditar ? 'Editar' : 'Submit'} failed (HTTP ${res.status})`,
        );
      }
      // Atualizar first, then close — re-opening the dialog
      // immediately should not show a stale list.
      if (user) await fetchModelos(user.id);
      toast.success(
        data.dry_run
          ? isEditar
            ? 'Modelo updated (dry-run — no Meta call)'
            : 'Modelo saved (dry-run — no Meta call)'
          : isEditar
            ? 'Editar submitted — Meta typically reviews within 24 hours.'
            : 'Submitted to Meta — typical review time is 24 hours. Status updates automatically.',
      );
      setDialogAberto(false);
      setForm(emptyForm);
      setEditaringId(null);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err instanceof Erro ? err.message : 'Falhou to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSyncFromMeta() {
    if (!user) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Erro(data?.error || `Sync failed (HTTP ${res.status})`);
      }
      toast.success(
        `Synced ${data.total} template${data.total === 1 ? '' : 's'} from Meta` +
          (data.inserted || data.updated
            ? ` (${data.inserted} new, ${data.updated} updated)`
            : ''),
      );
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const preview = data.errors.slice(0, 3).map(
          (e: { name: string; language: string; message: string }) =>
            `${e.name} (${e.language})`,
        );
        const suffix =
          data.errors.length > 3 ? `, +${data.errors.length - 3} more` : '';
        toast.error(`Falhou to sync: ${preview.join(', ')}${suffix}`);
      }
      if (data.truncated) {
        // Use error (not warning) so the message survives long
        // enough to read — sonner's `warning` auto-dismisses on
        // the same short timer as `success`.
        toast.error(
          'Synced the first 2000 templates only — your account has more. Sync again to continue, or contact support if this persists.',
          { duration: 10000 },
        );
      }
      await fetchModelos(user.id);
    } catch (err) {
      console.error('Modelo sync error:', err);
      toast.error(err instanceof Erro ? err.message : 'Falhou to sync templates');
    } finally {
      setSyncing(false);
    }
  }

  async function confirmExcluir() {
    const target = templateToExcluir;
    if (!target || deletingId) return;
    setDeletingId(target.id);
    try {
      // Route handler scopes the Meta delete via hsm_id (so sibling
      // language variants survive) and falls through to remove the
      // local row. Local-only rows skip the Meta call.
      const res = await fetch(`/api/whatsapp/templates/${target.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Erro(data?.error || `Excluir failed (HTTP ${res.status})`);
      }
      toast.success('Modelo deleted');
      setModelos((prev) => prev.filter((t) => t.id !== target.id));
      setModeloToExcluir(null);
    } catch (err) {
      console.error('Excluir error:', err);
      toast.error(err instanceof Erro ? err.message : 'Falhou to delete template');
    } finally {
      setDeletingId(null);
    }
  }

  // The patch type unions every field across button variants. The
  // conditional rendering below ensures only fields valid for the
  // current button's `type` reach this function, so the runtime
  // assertion + per-type spread preserves discriminated-union
  // invariants without forcing every call site to thread the type
  // through generics (which TS can't infer from a partial literal).
  type ButtonPatch = {
    text?: string;
    url?: string;
    phone_number?: string;
    example?: string;
  };
  function updateButton(index: number, patch: ButtonPatch) {
    setForm((prev) => {
      const current = prev.buttons[index];
      if (!current) return prev;
      const next = [...prev.buttons];
      // Per-variant spread keeps the discriminant pinned. Switch
      // exhaustiveness is enforced by TypeScript.
      switch (current.type) {
        case 'QUICK_REPLY':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
          };
          break;
        case 'URL':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.url !== undefined && { url: patch.url }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
        case 'PHONE_NUMBER':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.phone_number !== undefined && {
              phone_number: patch.phone_number,
            }),
          };
          break;
        case 'COPY_CODE':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
      }
      return { ...prev, buttons: next };
    });
  }

  function changeButtonType(index: number, type: ModeloButton['type']) {
    setForm((prev) => {
      const next = [...prev.buttons];
      next[index] = emptyButton(type);
      return { ...prev, buttons: next };
    });
  }

  function removeButton(index: number) {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  }

  function addButton() {
    if (form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal) return;
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, emptyButton('QUICK_REPLY')],
    }));
  }

  if (loading) {
    return (
      <div classNome="flex items-center justify-center py-12">
        <Loader2 classNome="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const headerNeedsMedia =
    form.header_format !== 'none' && form.header_format !== 'text';

  return (
    <div classNome="space-y-4 mt-4">
      <div classNome="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 classNome="text-lg font-semibold text-white">Message Modelos</h2>
          <p classNome="text-sm text-slate-400">
            Criar message templates and submit them to Meta for approval. Use
            &quot;Sync from Meta&quot; to pull templates approved elsewhere.
          </p>
        </div>
        <div classNome="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncFromMeta}
            disabled={syncing}
            classNome="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            title="Pull approved templates from your Meta WhatsApp Business Account"
          >
            <AtualizarCw classNome={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Meta'}
          </Button>
          <Button
            onClick={openCriar}
            classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus classNome="size-4" />
            Novo Modelo
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardContent classNome="flex flex-col items-center justify-center py-12 text-center">
            <p classNome="text-slate-400 text-sm">No templates yet.</p>
            <p classNome="text-slate-500 text-xs mt-1">
              Criar your first message template to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div classNome="grid gap-3">
          {templates.map((template) => {
            const statusKey = template.status || 'DRAFT';
            const status = templateStatusConfig[statusKey];
            return (
              <Card
                key={template.id}
                classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent"
              >
                <CardContent classNome="flex items-start justify-between pt-4">
                  <div classNome="space-y-2 min-w-0 flex-1">
                    <div classNome="flex items-center gap-2 flex-wrap">
                      <h3 classNome="font-medium text-white">{template.name}</h3>
                      <Badge
                        classNome={`text-xs border ${categoryCors[template.category] || ''}`}
                      >
                        {template.category}
                      </Badge>
                      <Badge classNome={`text-xs border ${status.classes}`}>
                        {status.label}
                      </Badge>
                      {template.language && (
                        <span classNome="text-xs text-slate-500 uppercase">
                          {template.language}
                        </span>
                      )}
                      {template.quality_score && (
                        <span
                          classNome={`text-[10px] uppercase font-medium ${
                            template.quality_score === 'GREEN'
                              ? 'text-emerald-400'
                              : template.quality_score === 'YELLOW'
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                          title="Meta quality score"
                        >
                          {template.quality_score}
                        </span>
                      )}
                    </div>
                    <p classNome="text-sm text-slate-400 line-clamp-2">
                      {template.body_text}
                    </p>
                    {template.footer_text && (
                      <p classNome="text-xs text-slate-500 italic">
                        {template.footer_text}
                      </p>
                    )}
                    {(template.rejection_reason || template.submission_error) && (
                      <div classNome="flex items-start gap-1.5 text-xs text-red-400 bg-red-950/20 border border-red-900/40 rounded px-2 py-1.5">
                        <AlertCircle classNome="size-3.5 mt-0.5 shrink-0" />
                        <span>
                          {template.rejection_reason || template.submission_error}
                        </span>
                      </div>
                    )}
                  </div>
                  <div classNome="flex items-center gap-1 shrink-0 ml-2">
                    {statusKey === 'APPROVED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditar(template)}
                        title="Editaring triggers Meta re-review — status flips to PENDING."
                        aria-label="Editar template"
                        classNome="text-slate-300 hover:text-primary hover:bg-primary/10 h-8 px-2"
                      >
                        <Pencil classNome="size-3.5" />
                        Editar
                      </Button>
                    )}
                    {(statusKey === 'REJECTED' || statusKey === 'PAUSED') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditar(template)}
                        title="Editar the template and resubmit to Meta for review."
                        aria-label="Editar and resubmit template"
                        classNome="text-slate-300 hover:text-primary hover:bg-primary/10 h-8 px-2"
                      >
                        <RotateCcw classNome="size-3.5" />
                        Resubmit
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setModeloToExcluir(template)}
                      disabled={deletingId === template.id}
                      aria-label={
                        template.meta_template_id
                          ? 'Excluir template from Meta and locally'
                          : 'Excluir template locally'
                      }
                      title={
                        template.meta_template_id
                          ? 'Excluir from Meta and locally'
                          : 'Excluir locally'
                      }
                      classNome="text-slate-400 hover:text-red-400 hover:bg-red-950/30 h-8 w-8"
                    >
                      {deletingId === template.id ? (
                        <Loader2 classNome="size-4 animate-spin" />
                      ) : (
                        <Trash2 classNome="size-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogAberto}
        onAbertoChange={(open) => {
          setDialogAberto(open);
          if (!open) {
            setEditaringId(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle classNome="text-white">
              {editingId ? 'Editar Message Modelo' : 'Novo Message Modelo'}
            </DialogTitle>
            <DialogDescription classNome="text-slate-400">
              {editingId
                ? 'Salvar your changes to re-submit to Meta. Status will flip back to PENDING during review.'
                : 'Build a template and submit it to Meta for approval. Once approved, you can use it in broadcasts and the inbox.'}
            </DialogDescription>
          </DialogHeader>

          {form.category === 'Authentication' && (
            <div classNome="flex items-start gap-2 rounded border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              <AlertCircle classNome="size-4 mt-0.5 shrink-0" />
              <p>
                AUTHENTICATION templates have a fixed body + OTP button shape
                that needs a different builder. Criar them in Meta WhatsApp
                Manager for now and use <strong>Sync from Meta</strong> to
                bring them in.
              </p>
            </div>
          )}

          <div classNome="space-y-4 py-2">
            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Modelo Nome</Rótulo>
              <Input
                placeholder="e.g. order_confirmation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={editingId !== null}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p classNome="text-[11px] text-slate-500">
                {editingId
                  ? 'Nome is fixed once a template exists on Meta — create a new template to change it.'
                  : 'Lowercase letters, digits, and underscores only.'}
              </p>
            </div>

            <div classNome="grid grid-cols-2 gap-4">
              <div classNome="space-y-2">
                <Rótulo classNome="text-slate-300">Category</Rótulo>
                <Selecionar
                  value={form.category}
                  onValorChange={(val) =>
                    setForm({
                      ...form,
                      category: val as MessageModelo['category'],
                    })
                  }
                >
                  <SelecionarGatilho classNome="w-full bg-slate-800 border-slate-700 text-white">
                    <SelecionarValor />
                  </SelecionarGatilho>
                  <SelecionarContent classNome="bg-slate-800 border-slate-700">
                    {CATEGORIES.map((cat) => (
                      <SelecionarItem
                        key={cat}
                        value={cat}
                        classNome="text-white focus:bg-slate-700 focus:text-white"
                      >
                        {cat}
                      </SelecionarItem>
                    ))}
                  </SelecionarContent>
                </Selecionar>
              </div>

              <div classNome="space-y-2">
                <Rótulo classNome="text-slate-300">Language</Rótulo>
                <Input
                  list="template-language-codes"
                  placeholder="en_US"
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                  disabled={editingId !== null}
                  classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <datalist id="template-language-codes">
                  {COMMON_LANGUAGE_CODES.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
                <p classNome="text-[11px] text-slate-500">
                  {editingId
                    ? 'Language is fixed once a template exists on Meta.'
                    : (
                        <>
                          Must match the exact code on Meta — <code>en_US</code>{' '}
                          and <code>en</code> are distinct.
                        </>
                      )}
                </p>
              </div>
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Header</Rótulo>
              <Selecionar
                value={form.header_format}
                onValorChange={(val) =>
                  // Preserve header_content, header_media_url, and
                  // header_sample across format switches. The submit
                  // payload builder only reads the field that matches
                  // the active format, so an orphan value on a hidden
                  // field is harmless — and keeping it lets the user
                  // switch formats to compare without losing typing.
                  setForm({
                    ...form,
                    header_format: (val || 'none') as HeaderFormat,
                  })
                }
              >
                <SelecionarGatilho classNome="w-full bg-slate-800 border-slate-700 text-white">
                  <SelecionarValor />
                </SelecionarGatilho>
                <SelecionarContent classNome="bg-slate-800 border-slate-700">
                  {HEADER_FORMATS.map((type) => (
                    <SelecionarItem
                      key={type}
                      value={type}
                      classNome="text-white focus:bg-slate-700 focus:text-white"
                    >
                      {type === 'none'
                        ? 'Nenhum'
                        : type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelecionarItem>
                  ))}
                </SelecionarContent>
              </Selecionar>

              {form.header_format === 'text' && (
                <div classNome="space-y-2 mt-2">
                  <Input
                    id="template-header-text"
                    aria-label="Header text"
                    placeholder="Header text (max 60 chars, optional {{1}})"
                    value={form.header_content}
                    onChange={(e) =>
                      setForm({ ...form, header_content: e.target.value })
                    }
                    maxLength={TEMPLATE_LIMITS.headerTextMaxLength}
                    classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  {headerVarCount > 0 && (
                    <Input
                      id="template-header-sample"
                      aria-label="Sample value for header variable"
                      placeholder="Sample value for {{1}} (required for Meta review)"
                      value={form.header_sample}
                      onChange={(e) =>
                        setForm({ ...form, header_sample: e.target.value })
                      }
                      classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  )}
                </div>
              )}

              {headerNeedsMedia && (
                <div classNome="space-y-2 mt-2">
                  <Input
                    placeholder={`https://… (public link to a sample ${form.header_format})`}
                    value={form.header_media_url}
                    onChange={(e) =>
                      setForm({ ...form, header_media_url: e.target.value })
                    }
                    classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <p classNome="text-[11px] text-slate-500 leading-relaxed">
                    Must be publicly accessible HTTPS. Meta fetches it once
                    during review, so the file needs to stay live for ~24 hrs.
                    {form.header_format === 'image' &&
                      ' Recommended: JPEG or PNG, ≥800×418 px, ≤5 MB.'}
                    {form.header_format === 'video' &&
                      ' Recommended: MP4 / 3GPP, ≤16 MB, ≤60 seconds.'}
                    {form.header_format === 'document' &&
                      ' Recommended: PDF, ≤100 MB.'}
                    {' '}Direct file upload is coming in a follow-up.
                  </p>
                </div>
              )}
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Body Text</Rótulo>
              <Textarea
                placeholder="Hello {{1}}, your order {{2}} is confirmed."
                value={form.body_text}
                onChange={(e) =>
                  setForm({ ...form, body_text: e.target.value })
                }
                rows={4}
                maxLength={TEMPLATE_LIMITS.bodyMaxLength}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              />
              <p classNome="text-[11px] text-slate-500">
                Use {`{{1}}`}, {`{{2}}`} for variables (must be contiguous
                starting at {`{{1}}`}).
              </p>

              {bodyVarCount > 0 && (
                <div classNome="space-y-1.5 pt-1">
                  <Rótulo classNome="text-[11px] text-slate-400">
                    Sample values (Meta uses these to review your template)
                  </Rótulo>
                  {form.body_samples.map((val, i) => {
                    const inputId = `template-body-sample-${i}`;
                    return (
                      <Input
                        key={i}
                        id={inputId}
                        aria-label={`Sample value for body variable {{${i + 1}}}`}
                        placeholder={`Sample for {{${i + 1}}}`}
                        value={val}
                        onChange={(e) => {
                          const next = [...form.body_samples];
                          next[i] = e.target.value;
                          setForm({ ...form, body_samples: next });
                        }}
                        classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Footer (optional)</Rótulo>
              <Input
                placeholder="Opcional footer text (max 60 chars)"
                value={form.footer_text}
                onChange={(e) =>
                  setForm({ ...form, footer_text: e.target.value })
                }
                maxLength={TEMPLATE_LIMITS.footerMaxLength}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div classNome="space-y-2">
              <div classNome="flex items-center justify-between">
                <Rótulo classNome="text-slate-300">Buttons (optional)</Rótulo>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal}
                  classNome="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 h-7 text-xs"
                >
                  <Plus classNome="size-3" />
                  Adicionar Button
                </Button>
              </div>
              {form.buttons.length === 0 ? (
                <p classNome="text-[11px] text-slate-500">
                  Up to {TEMPLATE_LIMITS.maxButtonsTotal} buttons. QUICK_REPLY
                  buttons must come before URL / phone / copy-code buttons.
                </p>
              ) : (
                <div classNome="space-y-2">
                  {form.buttons.map((btn, i) => (
                    <div
                      key={i}
                      classNome="space-y-2 rounded border border-slate-700 bg-slate-800/50 p-2"
                    >
                      <div classNome="flex items-center gap-2">
                        <Selecionar
                          value={btn.type}
                          onValorChange={(val) => {
                            // Same null guard as the Header Selecionar
                            // (per PR 148): @base-ui Selecionar fires
                            // onValorChange(null) on deselect.
                            if (!val) return;
                            changeButtonType(i, val as ModeloButton['type']);
                          }}
                        >
                          <SelecionarGatilho classNome="w-40 bg-slate-800 border-slate-700 text-white h-8 text-xs">
                            <SelecionarValor />
                          </SelecionarGatilho>
                          <SelecionarContent classNome="bg-slate-800 border-slate-700">
                            <SelecionarItem
                              value="QUICK_REPLY"
                              classNome="text-white focus:bg-slate-700 focus:text-white"
                            >
                              Quick Reply
                            </SelecionarItem>
                            <SelecionarItem
                              value="URL"
                              classNome="text-white focus:bg-slate-700 focus:text-white"
                            >
                              URL
                            </SelecionarItem>
                            <SelecionarItem
                              value="PHONE_NUMBER"
                              classNome="text-white focus:bg-slate-700 focus:text-white"
                            >
                              Telefone
                            </SelecionarItem>
                            <SelecionarItem
                              value="COPY_CODE"
                              classNome="text-white focus:bg-slate-700 focus:text-white"
                            >
                              Copiar Code
                            </SelecionarItem>
                          </SelecionarContent>
                        </Selecionar>
                        <Input
                          placeholder="Button label"
                          value={btn.text}
                          maxLength={TEMPLATE_LIMITS.buttonTextMaxLength}
                          onChange={(e) =>
                            updateButton(i, { text: e.target.value })
                          }
                          classNome="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(i)}
                          classNome="text-slate-400 hover:text-red-400 hover:bg-red-950/30 size-7"
                        >
                          <X classNome="size-3.5" />
                        </Button>
                      </div>
                      {btn.type === 'URL' && (
                        <div classNome="space-y-1 pl-1">
                          <Input
                            placeholder="https://example.com/path or with {{1}} suffix"
                            value={btn.url}
                            onChange={(e) =>
                              updateButton(i, { url: e.target.value })
                            }
                            classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-8 text-xs"
                          />
                          {extractVariableIndices(btn.url).length > 0 && (
                            <Input
                              placeholder="Example value for {{1}} (required when URL has a variable)"
                              value={btn.example ?? ''}
                              onChange={(e) =>
                                updateButton(i, { example: e.target.value })
                              }
                              classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-8 text-xs"
                            />
                          )}
                        </div>
                      )}
                      {btn.type === 'PHONE_NUMBER' && (
                        <Input
                          placeholder="+15551234567"
                          value={btn.phone_number}
                          onChange={(e) =>
                            updateButton(i, { phone_number: e.target.value })
                          }
                          classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-8 text-xs"
                        />
                      )}
                      {btn.type === 'COPY_CODE' && (
                        <Input
                          placeholder="Example code (e.g. SUMMER20)"
                          value={btn.example}
                          onChange={(e) =>
                            updateButton(i, { example: e.target.value })
                          }
                          classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-8 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setDialogAberto(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || form.category === 'Authentication'}
              classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  {editingId ? 'Saving…' : 'Submitting…'}
                </>
              ) : editingId ? (
                'Salvar & Resubmit'
              ) : (
                'Submit for Approval'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar-delete dialog. Surfacing the meta_template_id case
          separately so users understand a real Meta delete is happening,
          not just a local cleanup. */}
      <Dialog
        open={templateToExcluir !== null}
        onAbertoChange={(open) => {
          if (!open) setModeloToExcluir(null);
        }}
      >
        <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle classNome="text-white">Excluir template?</DialogTitle>
            <DialogDescription classNome="text-slate-400">
              {templateToExcluir?.meta_template_id
                ? `"${templateToExcluir?.name}" will be deleted from Meta and from wacrm. Ativo broadcasts using this template will start failing on their next send. This can't be undone.`
                : `"${templateToExcluir?.name}" will be deleted from wacrm. It was never submitted to Meta, so no remote cleanup is needed.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setModeloToExcluir(null)}
              disabled={deletingId !== null}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmExcluir}
              disabled={deletingId !== null}
              classNome="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingId !== null ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
