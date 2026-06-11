'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, ContactNota, CustomField, ContactCustomValor, Deal } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsGatilho, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Telefone,
  Mail,
  Building2,
  Copiar,
  Check,
  Loader2,
  Plus,
  Trash2,
  Salvar,
  X,
  DollarSign,
} from 'lucide-react';

interface ContactDetailViewProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({
  open,
  onAbertoChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedTelefone, setCopiedTelefone] = useState(false);

  // Details tab
  const [editNome, setEditarNome] = useState('');
  const [editTelefone, setEditarTelefone] = useState('');
  const [editE-mail, setEditarE-mail] = useState('');
  const [editCompany, setEditarCompany] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // Etiquetas tab
  const [allEtiquetas, setTodosEtiquetas] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingEtiquetas, setSavingEtiquetas] = useState(false);

  // Notas tab
  const [notes, setNotas] = useState<ContactNota[]>([]);
  const [newNota, setNovoNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);
  const [loadingNotas, setLoadingNotas] = useState(false);

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValors, setCustomValors] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditarNome(data.name ?? '');
      setEditarTelefone(data.phone);
      setEditarE-mail(data.email ?? '');
      setEditarCompany(data.company ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchEtiquetas = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactEtiquetasRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setTodosEtiquetas(tagsRes.data);
    if (contactEtiquetasRes.data) {
      setContactTagIds(contactEtiquetasRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotas = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotas(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotas(data);
    setLoadingNotas(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValors(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchEtiquetas();
      fetchNotas();
      fetchCustomFields();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchEtiquetas, fetchNotas, fetchCustomFields, fetchDeals]);

  async function copyTelefone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedTelefone(true);
    setTimeout(() => setCopiedTelefone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editTelefone.trim()) {
      toast.error('Número de telefone is required');
      return;
    }

    setSavingDetails(true);
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editNome.trim() || null,
        phone: editTelefone.trim(),
        email: editE-mail.trim() || null,
        company: editCompany.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) {
      toast.error('Falhou to update contact');
    } else {
      toast.success('Contact updated');
      fetchContact();
      onUpdated();
    }
    setSavingDetails(false);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingEtiquetas(true);

    const isSelecionared = contactTagIds.includes(tagId);

    if (isSelecionared) {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);
      if (!error) {
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
        onUpdated();
      }
    } else {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });
      if (!error) {
        setContactTagIds((prev) => [...prev, tagId]);
        onUpdated();
      }
    }
    setSavingEtiquetas(false);
  }

  async function addNota() {
    if (!contactId || !newNota.trim()) return;
    setSavingNota(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error('Not authenticated');
      setSavingNota(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNota.trim(),
    });

    if (error) {
      toast.error('Falhou to add note');
    } else {
      setNovoNota('');
      fetchNotas();
      toast.success('Nota added');
    }
    setSavingNota(false);
  }

  async function deleteNota(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error('Falhou to delete note');
    } else {
      setNotas((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Nota deleted');
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);

    try {
      // Excluir existing values and re-insert
      await supabase
        .from('contact_custom_values')
        .delete()
        .eq('contact_id', contactId);

      const rows = Object.entries(customValors)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({
          contact_id: contactId,
          custom_field_id: fieldId,
          value: val.trim(),
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('contact_custom_values')
          .insert(rows);
        if (error) throw error;
      }

      toast.success('Custom fields saved');
    } catch {
      toast.error('Falhou to save custom fields');
    }
    setSavingCustom(false);
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Sheet open={open} onAbertoChange={onAbertoChange}>
      <SheetContent
        side="right"
        classNome="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0"
      >
        {loading || !contact ? (
          <div classNome="flex items-center justify-center h-full">
            <Loader2 classNome="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div classNome="flex flex-col h-full">
            {/* Header */}
            <SheetHeader classNome="p-4 border-b border-slate-700/50">
              <div classNome="flex items-center gap-3">
                <Avatar classNome="size-12 bg-slate-800 border border-slate-700">
                  <AvatarFallback classNome="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div classNome="flex-1 min-w-0">
                  <SheetTitle classNome="text-white truncate">
                    {contact.name || 'Unknown'}
                  </SheetTitle>
                  <SheetDescription classNome="text-slate-400 text-xs mt-0.5">
                    Contact details
                  </SheetDescription>
                  <div classNome="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <button
                      onClick={copyTelefone}
                      classNome="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Telefone classNome="size-3" />
                      {contact.phone}
                      {copiedTelefone ? (
                        <Check classNome="size-3 text-primary" />
                      ) : (
                        <Copiar classNome="size-3" />
                      )}
                    </button>
                    {contact.email && (
                      <span classNome="flex items-center gap-1">
                        <Mail classNome="size-3" />
                        {contact.email}
                      </span>
                    )}
                    {contact.company && (
                      <span classNome="flex items-center gap-1">
                        <Building2 classNome="size-3" />
                        {contact.company}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValor="details" classNome="flex-1 flex flex-col min-h-0">
              <TabsList classNome="bg-slate-800/50 border-b border-slate-700 mx-4 mt-3">
                <TabsGatilho
                  value="details"
                  classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
                >
                  Details
                </TabsGatilho>
                <TabsGatilho
                  value="tags"
                  classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
                >
                  Etiquetas
                </TabsGatilho>
                <TabsGatilho
                  value="notes"
                  classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
                >
                  Notas
                </TabsGatilho>
                <TabsGatilho
                  value="custom"
                  classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
                >
                  Custom Fields
                </TabsGatilho>
                <TabsGatilho
                  value="deals"
                  classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
                >
                  Deals
                </TabsGatilho>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" classNome="flex-1 overflow-y-auto px-4 py-3">
                <div classNome="space-y-3">
                  <div classNome="space-y-1.5">
                    <Rótulo classNome="text-slate-400 text-xs">Nome</Rótulo>
                    <Input
                      value={editNome}
                      onChange={(e) => setEditarNome(e.target.value)}
                      classNome="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div classNome="space-y-1.5">
                    <Rótulo classNome="text-slate-400 text-xs">
                      Telefone <span classNome="text-red-400">*</span>
                    </Rótulo>
                    <Input
                      value={editTelefone}
                      onChange={(e) => setEditarTelefone(e.target.value)}
                      classNome="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div classNome="space-y-1.5">
                    <Rótulo classNome="text-slate-400 text-xs">E-mail</Rótulo>
                    <Input
                      value={editE-mail}
                      onChange={(e) => setEditarE-mail(e.target.value)}
                      classNome="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div classNome="space-y-1.5">
                    <Rótulo classNome="text-slate-400 text-xs">Company</Rótulo>
                    <Input
                      value={editCompany}
                      onChange={(e) => setEditarCompany(e.target.value)}
                      classNome="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <Button
                    onClick={saveDetails}
                    disabled={savingDetails}
                    classNome="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                    size="sm"
                  >
                    {savingDetails ? (
                      <Loader2 classNome="size-3.5 animate-spin" />
                    ) : (
                      <Salvar classNome="size-3.5" />
                    )}
                    Salvar Changes
                  </Button>
                </div>
              </TabsContent>

              {/* Etiquetas Tab */}
              <TabsContent value="tags" classNome="flex-1 overflow-y-auto px-4 py-3">
                <div classNome="space-y-3">
                  <p classNome="text-xs text-slate-400">
                    Click a tag to add or remove it from this contact.
                  </p>
                  {allEtiquetas.length === 0 ? (
                    <p classNome="text-sm text-slate-500">
                      Nenhuma etiqueta available. Criar etiquetas in Settings.
                    </p>
                  ) : (
                    <div classNome="flex flex-wrap gap-2">
                      {allEtiquetas.map((tag) => {
                        const selected = contactTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            disabled={savingEtiquetas}
                            classNome={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                              selected
                                ? 'ring-2 ring-primary ring-offset-1 ring-offset-slate-900'
                                : 'opacity-50 hover:opacity-80'
                            }`}
                            style={{
                              backgroundCor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {selected && <Check classNome="size-3 mr-1" />}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Notas Tab */}
              <TabsContent value="notes" classNome="flex-1 flex flex-col min-h-0 px-4 py-3">
                <div classNome="space-y-2 mb-3">
                  <Textarea
                    value={newNota}
                    onChange={(e) => setNovoNota(e.target.value)}
                    placeholder="Write a note..."
                    classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[60px] text-sm resize-none"
                  />
                  <Button
                    onClick={addNota}
                    disabled={!newNota.trim() || savingNota}
                    classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
                    size="sm"
                  >
                    {savingNota ? (
                      <Loader2 classNome="size-3.5 animate-spin" />
                    ) : (
                      <Plus classNome="size-3.5" />
                    )}
                    Adicionar Nota
                  </Button>
                </div>

                <div classNome="flex-1 overflow-y-auto space-y-2">
                  {loadingNotas ? (
                    <div classNome="flex items-center justify-center py-8">
                      <Loader2 classNome="size-5 animate-spin text-slate-500" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p classNome="text-sm text-slate-500 text-center py-8">
                      No notes yet.
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        classNome="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3 group"
                      >
                        <div classNome="flex items-start justify-between gap-2">
                          <p classNome="text-sm text-slate-300 whitespace-pre-wrap flex-1">
                            {note.note_text}
                          </p>
                          <button
                            onClick={() => deleteNota(note.id)}
                            classNome="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 classNome="size-3.5" />
                          </button>
                        </div>
                        <p classNome="text-xs text-slate-500 mt-1.5">
                          {new Date(note.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Custom Fields Tab */}
              <TabsContent value="custom" classNome="flex-1 overflow-y-auto px-4 py-3">
                {loadingCustom ? (
                  <div classNome="flex items-center justify-center py-8">
                    <Loader2 classNome="size-5 animate-spin text-slate-500" />
                  </div>
                ) : customFields.length === 0 ? (
                  <p classNome="text-sm text-slate-500 text-center py-8">
                    No custom fields defined. Criar them in Settings.
                  </p>
                ) : (
                  <div classNome="space-y-3">
                    {customFields.map((field) => (
                      <div key={field.id} classNome="space-y-1.5">
                        <Rótulo classNome="text-slate-400 text-xs capitalize">
                          {field.field_name}
                        </Rótulo>
                        <Input
                          value={customValors[field.id] ?? ''}
                          onChange={(e) =>
                            setCustomValors((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.field_name}...`}
                          classNome="bg-slate-800 border-slate-700 text-white h-8 text-sm placeholder:text-slate-500"
                        />
                      </div>
                    ))}
                    <Button
                      onClick={saveCustomFields}
                      disabled={savingCustom}
                      classNome="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                      size="sm"
                    >
                      {savingCustom ? (
                        <Loader2 classNome="size-3.5 animate-spin" />
                      ) : (
                        <Salvar classNome="size-3.5" />
                      )}
                      Salvar Custom Fields
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" classNome="flex-1 overflow-y-auto px-4 py-3">
                {loadingDeals ? (
                  <div classNome="flex items-center justify-center py-8">
                    <Loader2 classNome="size-5 animate-spin text-primary" />
                  </div>
                ) : deals.length === 0 ? (
                  <p classNome="text-xs text-slate-500">No deals yet</p>
                ) : (
                  <div classNome="space-y-2">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        classNome="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                      >
                        <div classNome="flex items-start justify-between gap-2">
                          <p classNome="text-sm font-medium text-white">
                            {deal.title}
                          </p>
                          {deal.stage && (
                            <span
                              classNome="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundCor: `${deal.stage.color}20`,
                                color: deal.stage.color,
                              }}
                            >
                              {deal.stage.name}
                            </span>
                          )}
                        </div>
                        <div classNome="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                          <span classNome="flex items-center gap-1">
                            <DollarSign classNome="size-3" />
                            {formatCurrency(
                              deal.value ?? 0,
                              deal.currency || defaultCurrency,
                            )}
                          </span>
                          {deal.status && deal.status !== 'open' && (
                            <span
                              classNome={
                                deal.status === 'won'
                                  ? 'text-primary'
                                  : 'text-red-400'
                              }
                            >
                              {deal.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
