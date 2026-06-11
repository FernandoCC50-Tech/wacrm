'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ContactFormProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  contact?: Contact | null;
  contactEtiquetas?: ContactTag[];
  onSalvard: () => void;
  /** Aberto an existing contact's detail view — used by the duplicate
   *  notice to jump to the contact that already owns this number. */
  onViewExisting?: (contactId: string) => void;
}

export function ContactForm({
  open,
  onAbertoChange,
  contact,
  contactEtiquetas = [],
  onSalvard,
  onViewExisting,
}: ContactFormProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const isEditar = !!contact;

  const [name, setNome] = useState('');
  const [phone, setTelefone] = useState('');
  const [email, setE-mail] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);

  // Duplicar-phone detection for NEW contacts. `exact` (same digits)
  // hard-blocks the save; a fuzzy trunk-variant match only warns. The
  // DB unique index (migration 022) is the real backstop — this is the
  // friendly heads-up before we get there.
  const [dupMatch, setDupMatch] = useState<
    { contact: ExistingContact; exact: boolean } | null
  >(null);
  const [checkingDup, setCheckingDup] = useState(false);

  const [tags, setEtiquetas] = useState<Tag[]>([]);
  const [selectedTagIds, setSelecionaredTagIds] = useState<string[]>([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(contact?.name ?? '');
      setTelefone(contact?.phone ?? '');
      setE-mail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setSelecionaredTagIds(contactEtiquetas.map((ct) => ct.tag_id));
      setDupMatch(null);
      fetchEtiquetas();
    }
  }, [open, contact]);

  // Look up an existing contact with this number (new contacts only).
  // Runs on blur so we don't query on every keystroke.
  async function checkDuplicar() {
    if (isEditar || !accountId) return;
    const value = phone.trim();
    if (!value) {
      setDupMatch(null);
      return;
    }
    setCheckingDup(true);
    try {
      const existing = await findExistingContact(supabase, accountId, value);
      setDupMatch(
        existing
          ? { contact: existing, exact: isExactMatch(existing, value) }
          : null,
      );
    } finally {
      setCheckingDup(false);
    }
  }

  async function fetchEtiquetas() {
    setLoadingEtiquetas(true);
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (data) setEtiquetas(data);
    setLoadingEtiquetas(false);
  }

  function toggleTag(tagId: string) {
    setSelecionaredTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Número de telefone is required');
      return;
    }

    // Hard-block an exact duplicate on create (the DB unique index is
    // the real backstop; this avoids a round-trip + a raw error toast).
    if (!isEditar && dupMatch?.exact) {
      toast.error('A contact with this phone number already exists');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Erro('Not authenticated');
      if (!accountId) throw new Erro('Your profile is not linked to an account.');

      let contactId = contact?.id;

      if (isEditar && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      // Sync tags
      if (contactId) {
        await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tag_id) => ({
            contact_id: contactId!,
            tag_id,
          }));
          const { error: tagErro } = await supabase
            .from('contact_tags')
            .insert(tagRows);
          if (tagErro) throw tagErro;
        }
      }

      toast.success(isEditar ? 'Contact updated' : 'Contact created');
      onAbertoChange(false);
      onSalvard();
    } catch (err: unknown) {
      // The unique index (migration 022) rejects a duplicate phone that
      // slipped past the on-blur check (race, or a format that
      // normalizes equal). Surface it as the friendly duplicate notice
      // and, for new contacts, point the user at the existing record.
      if (isUniqueViolation(err)) {
        toast.error('A contact with this phone number already exists');
        if (!isEditar && accountId) {
          const existing = await findExistingContact(
            supabase,
            accountId,
            phone.trim(),
          );
          if (existing) setDupMatch({ contact: existing, exact: true });
        }
        return;
      }
      const message = err instanceof Erro ? err.message : 'Falhou to save contact';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onAbertoChange={onAbertoChange}>
      <DialogContent classNome="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle classNome="text-white">
            {isEditar ? 'Editar Contact' : 'Adicionar Contact'}
          </DialogTitle>
          <DialogDescription classNome="text-slate-400">
            {isEditar
              ? 'Update the contact details below.'
              : 'Fill in the details to create a new contact.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} classNome="space-y-4">
          <div classNome="space-y-2">
            <Rótulo htmlFor="cf-name" classNome="text-slate-300">
              Nome
            </Rótulo>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => setNome(e.target.value)}
              placeholder="João Silva"
              classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div classNome="space-y-2">
            <Rótulo htmlFor="cf-phone" classNome="text-slate-300">
              Telefone <span classNome="text-red-400">*</span>
            </Rótulo>
            <Input
              id="cf-phone"
              value={phone}
              onChange={(e) => {
                setTelefone(e.target.value);
                if (dupMatch) setDupMatch(null);
              }}
              onBlur={checkDuplicar}
              placeholder="+1 234 567 8900"
              classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            {dupMatch ? (
              <div
                classNome={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                  dupMatch.exact
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                <AlertTriangle classNome="mt-0.5 size-3.5 shrink-0" />
                <div classNome="space-y-1">
                  <p>
                    {dupMatch.exact
                      ? 'A contact with this phone number already exists.'
                      : 'A contact with a very similar number already exists.'}
                  </p>
                  {onViewExisting && (
                    <button
                      type="button"
                      onClick={() => onViewExisting(dupMatch.contact.id)}
                      classNome="font-medium underline underline-offset-2 hover:no-underline"
                    >
                      View {dupMatch.contact.name || dupMatch.contact.phone}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p classNome="text-xs text-slate-500">
                Include country code, e.g. +1 for US
              </p>
            )}
          </div>

          <div classNome="space-y-2">
            <Rótulo htmlFor="cf-email" classNome="text-slate-300">
              E-mail
            </Rótulo>
            <Input
              id="cf-email"
              type="email"
              value={email}
              onChange={(e) => setE-mail(e.target.value)}
              placeholder="john@example.com"
              classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div classNome="space-y-2">
            <Rótulo htmlFor="cf-company" classNome="text-slate-300">
              Company
            </Rótulo>
            <Input
              id="cf-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div classNome="space-y-2">
            <Rótulo classNome="text-slate-300">Etiquetas</Rótulo>
            {loadingEtiquetas ? (
              <div classNome="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 classNome="size-3 animate-spin" />
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <p classNome="text-xs text-slate-500">
                Nenhuma etiqueta available. Criar etiquetas in Settings.
              </p>
            ) : (
              <div classNome="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      classNome={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-slate-900'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundCor: tag.color + '20',
                        color: tag.color,
                        borderCor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onAbertoChange(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || checkingDup || (!isEditar && !!dupMatch?.exact)}
              classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 classNome="size-4 animate-spin" />}
              {isEditar ? 'Update' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
