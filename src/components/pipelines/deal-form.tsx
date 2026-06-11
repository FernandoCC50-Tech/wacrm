"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineEtapa,
  Profile,
} from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rótulo } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface DealFormProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineEtapa[];
  defaultEtapaId?: string;
  onSalvard: () => void;
}

export function DealForm({
  open,
  onAbertoChange,
  deal,
  pipelineId,
  stages,
  defaultEtapaId,
  onSalvard,
}: DealFormProps) {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [title, setTitle] = useState("");
  const [value, setValor] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setEtapaId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedFecharDate, setExpectedFecharDate] = useState("");
  const [notes, setNotas] = useState("");

  const [contacts, setContatos] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAção, setStatusAção] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmExcluir, setConfirmarExcluir] = useState(false);

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmarExcluir(false);
    if (deal) {
      setTitle(deal.title);
      setValor(String(deal.value ?? ""));
      setCurrency(deal.currency || defaultCurrency);
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setEtapaId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedFecharDate(deal.expected_close_date ?? "");
      setNotas(deal.notes ?? "");
    } else {
      setTitle("");
      setValor("");
      setCurrency(defaultCurrency);
      setContactId("");
      setEtapaId(defaultEtapaId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedFecharDate("");
      setNotas("");
    }
  }, [open, deal, defaultEtapaId, stages, defaultCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      setContatos((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSalvar() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error("Title, contact, and stage are required");
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedFecharDate || null,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error("Falhou to save deal");
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error("Not signed in");
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error("Your profile is not linked to an account.");
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
      if (error) {
        toast.error("Falhou to create deal");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? "Deal updated" : "Deal created");
    onAbertoChange(false);
    onSalvard();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAção(status);
    const { error } = await supabase
      .from("deals")
      .update({ status })
      .eq("id", deal.id);
    setStatusAção(null);
    if (error) {
      toast.error("Falhou to update deal status");
      return;
    }
    toast.success(
      status === "won" ? "Marked as won" : status === "lost" ? "Marked as lost" : "Deal reopened",
    );
    onAbertoChange(false);
    onSalvard();
  }

  async function handleExcluir() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error("Falhou to delete deal");
      return;
    }
    toast.success("Deal deleted");
    setConfirmarExcluir(false);
    onAbertoChange(false);
    onSalvard();
  }

  return (
    <Sheet open={open} onAbertoChange={onAbertoChange}>
      <SheetContent
        side="right"
        classNome="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0"
      >
        <div classNome="flex h-full flex-col">
          <SheetHeader classNome="border-b border-slate-700/50 p-4">
            <SheetTitle classNome="text-white">
              {deal ? "Editar Deal" : "Novo Deal"}
            </SheetTitle>
          </SheetHeader>

          <div classNome="flex-1 overflow-y-auto p-4 space-y-4">
            <div classNome="grid gap-2">
              <Rótulo classNome="text-slate-300">Title</Rótulo>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Deal title"
                classNome="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div classNome="grid gap-2">
              <Rótulo classNome="text-slate-300">Contact</Rótulo>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                classNome="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecionar a contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  classNome="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  <MessageSquare classNome="h-3 w-3" />
                  Link to Conversation
                </Link>
              )}
            </div>

            <div classNome="grid grid-cols-[1fr_110px] gap-3">
              <div classNome="grid gap-2">
                <Rótulo classNome="text-slate-300">Valor</Rótulo>
                <div classNome="relative">
                  <DollarSign classNome="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0"
                    classNome="border-slate-700 bg-slate-800 pl-7 text-white"
                  />
                </div>
              </div>
              <div classNome="grid gap-2">
                <Rótulo classNome="text-slate-300">Currency</Rótulo>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  classNome="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div classNome="grid gap-2">
              <Rótulo classNome="text-slate-300">Expected Fechar Date</Rótulo>
              <Input
                type="date"
                value={expectedFecharDate}
                onChange={(e) => setExpectedFecharDate(e.target.value)}
                classNome="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div classNome="grid gap-2">
              <Rótulo classNome="text-slate-300">Etapa</Rótulo>
              <select
                value={stageId}
                onChange={(e) => setEtapaId(e.target.value)}
                classNome="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div classNome="grid gap-2">
              <Rótulo classNome="text-slate-300">Assigned To</Rótulo>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                classNome="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="">Não atribuído</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div classNome="grid gap-2">
              <Rótulo classNome="text-slate-300">Notas</Rótulo>
              <Textarea
                value={notes}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Adicionar notas..."
                classNome="min-h-[100px] border-slate-700 bg-slate-800 text-white"
              />
            </div>

            {deal && (
              <div classNome="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <p classNome="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Status
                </p>
                <div classNome="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("won")}
                    disabled={!!statusAção || deal.status === "won"}
                    classNome="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {statusAção === "won" ? (
                      <Loader2 classNome="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check classNome="mr-1 h-4 w-4" />
                        Mark as Ganho
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("lost")}
                    disabled={!!statusAção || deal.status === "lost"}
                    classNome="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {statusAção === "lost" ? (
                      <Loader2 classNome="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X classNome="mr-1 h-4 w-4" />
                        Mark as Perdido
                      </>
                    )}
                  </Button>
                </div>
                {deal.status && deal.status !== "open" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange("open")}
                    disabled={!!statusAção}
                    classNome="w-full text-slate-400 hover:text-white"
                  >
                    Reabrir deal
                  </Button>
                )}
              </div>
            )}
          </div>

          <div classNome="border-t border-slate-700/50 bg-slate-900/80 p-4">
            <div classNome="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onAbertoChange(false)}
                classNome="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={saving || !title.trim() || !contactId || !stageId}
                classNome="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? "Salvando..." : deal ? "Salvar Changes" : "Criar Deal"}
              </Button>
            </div>

            {deal &&
              (confirmExcluir ? (
                <div classNome="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span classNome="text-red-300">Excluir this deal?</span>
                  <div classNome="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmarExcluir(false)}
                      disabled={deleting}
                      classNome="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleExcluir}
                      disabled={deleting}
                      classNome="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Confirmar"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmarExcluir(true)}
                  classNome="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 classNome="h-3 w-3" />
                  Excluir Deal
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
