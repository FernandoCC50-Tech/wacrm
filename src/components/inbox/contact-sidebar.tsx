"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNota, Tag } from "@/types";
import {
  Telefone,
  Mail,
  Copiar,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNota,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotas] = useState<ContactNota[]>([]);
  const [tags, setEtiquetas] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNota, setNovoNota] = useState("");
  const [addingNota, setAdicionaringNota] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotas(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setEtiquetas(mapped);
    }
  }, [contact]);

  // Load on contact change. setContactData/setEtiquetas run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopiarTelefone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAdicionarNota = useCallback(async () => {
    if (!contact || !newNota.trim()) return;
    if (!accountId) return;
    setAdicionaringNota(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNota.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotas((prev) => [data, ...prev]);
      setNovoNota("");
    }
    setAdicionaringNota(false);
  }, [contact, newNota, accountId]);

  if (!contact) {
    return (
      <div classNome="flex h-full w-70 items-center justify-center border-l border-slate-800 bg-slate-900">
        <p classNome="text-sm text-slate-500">Selecionar a conversation</p>
      </div>
    );
  }

  const displayNome = contact.name || contact.phone;
  const initials = displayNome.charAt(0).toUpperCase();

  return (
    <div classNome="flex h-full w-70 flex-col border-l border-slate-800 bg-slate-900">
      <ScrollArea classNome="flex-1">
        <div classNome="p-4">
          {/* Contact Info */}
          <div classNome="flex flex-col items-center text-center">
            <div classNome="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-white">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayNome}
                  classNome="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 classNome="mt-3 text-sm font-semibold text-white">
              {displayNome}
            </h3>
            {contact.company && (
              <p classNome="text-xs text-slate-400">{contact.company}</p>
            )}
          </div>

          {/* Telefone */}
          <div classNome="mt-4 space-y-2">
            <button
              onClick={handleCopiarTelefone}
              classNome="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Telefone classNome="h-4 w-4 text-slate-500" />
              <span classNome="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check classNome="h-3 w-3 text-primary" />
              ) : (
                <Copiar classNome="h-3 w-3 text-slate-600" />
              )}
            </button>

            {contact.email && (
              <div classNome="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300">
                <Mail classNome="h-4 w-4 text-slate-500" />
                <span classNome="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div classNome="my-4 border-t border-slate-800" />

          {/* Etiquetas */}
          <div>
            <div classNome="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <TagIcon classNome="h-3 w-3" />
              Etiquetas
            </div>
            <div classNome="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p classNome="px-1 text-xs text-slate-600">Nenhuma etiqueta</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    classNome="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundCor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div classNome="my-4 border-t border-slate-800" />

          {/* Ativo Deals */}
          <div>
            <div classNome="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <DollarSign classNome="h-3 w-3" />
              Ativo Deals
            </div>
            <div classNome="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p classNome="px-1 text-xs text-slate-600">No deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    classNome="rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <p classNome="text-sm font-medium text-white">
                      {deal.title}
                    </p>
                    <div classNome="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          classNome="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundCor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div classNome="my-4 border-t border-slate-800" />

          {/* Notas */}
          <div>
            <div classNome="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <StickyNota classNome="h-3 w-3" />
              Notas
            </div>
            <div classNome="mt-2">
              <div classNome="flex gap-2">
                <textarea
                  value={newNota}
                  onChange={(e) => setNovoNota(e.target.value)}
                  placeholder="Adicionar a note..."
                  rows={2}
                  classNome="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  classNome="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAdicionarNota}
                  disabled={!newNota.trim() || addingNota}
                >
                  <Plus classNome="h-3 w-3" />
                </Button>
              </div>

              <div classNome="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    classNome="rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <p classNome="whitespace-pre-wrap text-xs text-slate-300">
                      {note.note_text}
                    </p>
                    <p classNome="mt-1 text-[10px] text-slate-600">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
