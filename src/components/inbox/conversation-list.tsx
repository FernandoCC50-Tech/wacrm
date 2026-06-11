"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/types";
import { Search, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGatilho,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelecionar: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Opcional so existing callers keep working.
   */
  resyncToken?: number;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-slate-500",
};

const FILTER_OPTIONS: { label: string; value: ConversationStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Aberto", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Fechard", value: "closed" },
];

export function ConversationList({
  activeConversationId,
  onSelecionar,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFiltrar] = useState<ConversationStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Anteriorly the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Falhou to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelecionar = useCallback(
    (conv: Conversation) => {
      onSelecionar(conv);
    },
    [onSelecionar]
  );

  const activeFiltrar = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div classNome="flex h-full w-full flex-col border-r border-slate-800 bg-slate-900 lg:w-80">
      {/* Search + Filtrar */}
      <div classNome="space-y-2 border-b border-slate-800 p-3">
        <div classNome="relative">
          <Search classNome="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Buscar conversas..."
            classNome="border-slate-700 bg-slate-800 pl-9 text-sm text-white placeholder-slate-500 focus:border-primary/50"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuGatilho classNome="inline-flex items-center justify-center h-7 gap-1 px-2 text-xs text-slate-400 hover:text-white rounded-md hover:bg-slate-800">
              {activeFiltrar?.label ?? "Todos"}
              <ChevronDown classNome="h-3 w-3" />
          </DropdownMenuGatilho>
          <DropdownMenuContent
            align="start"
            classNome="border-slate-700 bg-slate-800"
          >
            {FILTER_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setFiltrar(opt.value)}
                classNome={cn(
                  "text-sm",
                  filter === opt.value
                    ? "text-primary"
                    : "text-slate-300"
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <ScrollArea classNome="min-h-0 flex-1">
        {loading ? (
          <div classNome="flex items-center justify-center py-12">
            <div classNome="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div classNome="px-4 py-12 text-center">
            <p classNome="text-sm text-slate-500">Nenhuma conversa found</p>
          </div>
        ) : (
          <div classNome="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isAtivo={conv.id === activeConversationId}
                onSelecionar={handleSelecionar}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isAtivo: boolean;
  onSelecionar: (conversation: Conversation) => void;
}

function ConversationItem({
  conversation,
  isAtivo,
  onSelecionar,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayNome = contact?.name || contact?.phone || "Unknown";
  const initials = displayNome.charAt(0).toUpperCase();

  const handleClick = useCallback(() => {
    onSelecionar(conversation);
  }, [onSelecionar, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
      })
    : "";

  return (
    <button
      onClick={handleClick}
      classNome={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-800/50",
        isAtivo && "border-l-2 border-primary bg-slate-800/70"
      )}
    >
      {/* Avatar */}
      <div classNome="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayNome}
            classNome="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div classNome="min-w-0 flex-1">
        <div classNome="flex items-center justify-between gap-2">
          <span classNome="truncate text-sm font-medium text-white">
            {displayNome}
          </span>
          <span classNome="shrink-0 text-[10px] text-slate-500">{timeAgo}</span>
        </div>
        <div classNome="mt-0.5 flex items-center justify-between gap-2">
          <p classNome="truncate text-xs text-slate-400">
            {conversation.last_message_text || "Nenhuma mensagem ainda"}
          </p>
          <div classNome="flex shrink-0 items-center gap-1.5">
            {conversation.unread_count > 0 && (
              <span classNome="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {conversation.unread_count}
              </span>
            )}
            <span
              classNome={cn(
                "h-2 w-2 rounded-full",
                STATUS_COLORS[conversation.status]
              )}
              title={conversation.status}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
