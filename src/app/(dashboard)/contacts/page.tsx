'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuGatilho,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Enviar,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportarModal } from '@/components/contacts/import-modal';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';

const PAGE_SIZE = 25;

interface ContactWithEtiquetas extends Contact {
  tags?: Tag[];
}

export default function ContatosPage() {
  const supabase = createClient();
  const canEditar = useCan('send-messages');

  const [contacts, setContatos] = useState<ContactWithEtiquetas[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [formAberto, setFormAberto] = useState(false);
  const [editContact, setEditarContact] = useState<Contact | null>(null);
  const [editContactEtiquetas, setEditarContactEtiquetas] = useState<ContactTag[]>([]);
  const [detailAberto, setDetailAberto] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importAberto, setImportarAberto] = useState(false);
  const [deleteConfirmarAberto, setExcluirConfirmarAberto] = useState(false);
  const [deleteTarget, setExcluirTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Todos tags for display
  const [tagsMap, setEtiquetasMap] = useState<Record<string, Tag>>({});

  const fetchEtiquetas = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setEtiquetasMap(map);
    }
  }, [supabase]);

  const fetchContatos = useCallback(async () => {
    setLoading(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    const { data, count, error } = await query;

    if (error) {
      toast.error('Falhou to load contacts');
      setLoading(false);
      return;
    }

    setTotalCount(count ?? 0);

    if (!data || data.length === 0) {
      setContatos([]);
      setLoading(false);
      return;
    }

    // Fetch tags for these contacts
    const contactIds = data.map((c) => c.id);
    const { data: contactEtiquetas } = await supabase
      .from('contact_tags')
      .select('contact_id, tag_id')
      .in('contact_id', contactIds);

    const tagsByContact: Record<string, string[]> = {};
    contactEtiquetas?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const enriched: ContactWithEtiquetas[] = data.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));

    setContatos(enriched);
    setLoading(false);
  }, [supabase, page, search, tagsMap]);

  // Load-once-on-mount-ish data fetches. Each setter inside runs
  // inside an async promise completion (Supabase await), not
  // synchronously in the effect body, so the cascade the lint rule
  // warns about doesn't apply here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEtiquetas();
  }, [fetchEtiquetas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContatos();
  }, [fetchContatos]);

  function openAdicionarForm() {
    setEditarContact(null);
    setEditarContactEtiquetas([]);
    setFormAberto(true);
  }

  async function openEditarForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditarContact(contact);
    setEditarContactEtiquetas(data ?? []);
    setFormAberto(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailAberto(true);
  }

  function confirmExcluir(contact: Contact) {
    setExcluirTarget(contact);
    setExcluirConfirmarAberto(true);
  }

  async function handleExcluir() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Falhou to delete contact');
    } else {
      toast.success('Contact deleted');
      fetchContatos();
    }

    setDeleting(false);
    setExcluirConfirmarAberto(false);
    setExcluirTarget(null);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPróximo = page < totalPages - 1;
  const hasPrev = page > 0;

  return (
    <div classNome="space-y-6">
      {/* Header */}
      <div classNome="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 classNome="text-2xl font-bold text-white">Contatos</h1>
          <p classNome="text-sm text-slate-400 mt-1">
            Manage your contact list. {totalCount > 0 && `${totalCount} total contacts.`}
          </p>
        </div>
        <div classNome="flex items-center gap-2">
          <GatedButton
            variant="outline"
            canAct={canEditar}
            gateReason="add or import contacts"
            onClick={() => setImportarAberto(true)}
            classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Enviar classNome="size-4" />
            Importar
          </GatedButton>
          <GatedButton
            canAct={canEditar}
            gateReason="add or import contacts"
            onClick={openAdicionarForm}
            classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus classNome="size-4" />
            Adicionar Contact
          </GatedButton>
        </div>
      </div>

      {/* Search */}
      <div classNome="relative max-w-sm">
        <Search classNome="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            // Reset pagination when the query changes — the result
            // set shrinks/grows, page N may no longer be valid.
            setPage(0);
          }}
          placeholder="Search by name, phone, or email..."
          classNome="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Table */}
      <div classNome="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow classNome="border-slate-800 hover:bg-transparent">
              <TableHead classNome="text-slate-400">Nome</TableHead>
              <TableHead classNome="text-slate-400">Telefone</TableHead>
              <TableHead classNome="text-slate-400 hidden md:table-cell">E-mail</TableHead>
              <TableHead classNome="text-slate-400 hidden lg:table-cell">Company</TableHead>
              <TableHead classNome="text-slate-400 hidden md:table-cell">Etiquetas</TableHead>
              <TableHead classNome="text-slate-400 hidden lg:table-cell">Criard</TableHead>
              <TableHead classNome="text-slate-400 w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow classNome="border-slate-800">
                <TableCell colSpan={7} classNome="text-center py-12">
                  <div classNome="flex flex-col items-center gap-2">
                    <Loader2 classNome="size-6 animate-spin text-primary" />
                    <p classNome="text-sm text-slate-500">Loading contacts...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow classNome="border-slate-800">
                <TableCell colSpan={7} classNome="text-center py-12">
                  <div classNome="flex flex-col items-center gap-2">
                    <Users classNome="size-8 text-slate-600" />
                    <p classNome="text-sm text-slate-500">
                      {search ? 'No contacts match your search.' : 'No contacts yet.'}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAdicionarForm}
                        classNome="mt-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        <Plus classNome="size-3.5" />
                        Adicionar your first contact
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  classNome="border-slate-800 hover:bg-slate-900/50 cursor-pointer"
                  onClick={() => openDetail(contact.id)}
                >
                  <TableCell classNome="text-white font-medium">
                    {contact.name || <span classNome="text-slate-500 italic">Unnamed</span>}
                  </TableCell>
                  <TableCell classNome="text-slate-300 font-mono text-xs">
                    {contact.phone}
                  </TableCell>
                  <TableCell classNome="text-slate-400 hidden md:table-cell text-sm">
                    {contact.email || <span classNome="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell classNome="text-slate-400 hidden lg:table-cell text-sm">
                    {contact.company || <span classNome="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell classNome="hidden md:table-cell">
                    <div classNome="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            classNome="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundCor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span classNome="text-slate-600 text-xs">-</span>
                      )}
                      {contact.tags && contact.tags.length > 3 && (
                        <span classNome="text-[10px] text-slate-500">
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell classNome="text-slate-500 text-xs hidden lg:table-cell">
                    {new Date(contact.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuGatilho
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            classNome="text-slate-400 hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          />
                        }
                      >
                        <MoreHorizontal classNome="size-4" />
                      </DropdownMenuGatilho>
                      <DropdownMenuContent
                        align="end"
                        classNome="bg-slate-900 border-slate-700"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditarForm(contact);
                          }}
                          classNome="text-slate-300 focus:bg-slate-800 focus:text-white"
                        >
                          <Pencil classNome="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator classNome="bg-slate-700" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmExcluir(contact);
                          }}
                        >
                          <Trash2 classNome="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div classNome="flex items-center justify-between">
          <p classNome="text-xs text-slate-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{' '}
            {totalCount}
          </p>
          <div classNome="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              classNome="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft classNome="size-4" />
            </Button>
            <span classNome="text-xs text-slate-400 px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPróximo}
              onClick={() => setPage((p) => p + 1)}
              classNome="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
            >
              <ChevronRight classNome="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Form Dialog */}
      <ContactForm
        open={formAberto}
        onAbertoChange={setFormAberto}
        contact={editContact}
        contactEtiquetas={editContactEtiquetas}
        onSalvard={() => {
          fetchContatos();
          fetchEtiquetas();
        }}
        onViewExisting={(id) => {
          setFormAberto(false);
          openDetail(id);
        }}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailView
        open={detailAberto}
        onAbertoChange={setDetailAberto}
        contactId={detailContactId}
        onUpdated={fetchContatos}
      />

      {/* Importar Modal */}
      <ImportarModal
        open={importAberto}
        onAbertoChange={setImportarAberto}
        onImportared={fetchContatos}
      />

      {/* Excluir Confirmaration */}
      <Dialog open={deleteConfirmarAberto} onAbertoChange={setExcluirConfirmarAberto}>
        <DialogContent classNome="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle classNome="text-white">Excluir Contact</DialogTitle>
            <DialogDescription classNome="text-slate-400">
              Are you sure you want to delete{' '}
              <span classNome="text-slate-200 font-medium">
                {deleteTarget?.name || deleteTarget?.phone}
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setExcluirConfirmarAberto(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleExcluir}
              disabled={deleting}
            >
              {deleting && <Loader2 classNome="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
