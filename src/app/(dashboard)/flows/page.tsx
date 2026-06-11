"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Workflow,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  MessageSquare,
  PlayCircle,
  PauseCircle,
  Archive,
  HelpCircle,
  UserPlus,
  FileText,
} from "lucide-react";

import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Flows list page.
 *
 * Aberto to every authenticated user. Flows is in soft-GA — the "Beta"
 * chip in the header is the only remaining signal that the surface
 * is new. The previous per-account beta gate was removed in PR #134.
 */

interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: { keywords?: string[] } | Record<string, unknown>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<FlowRow["status"], string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Archived",
};

const STATUS_COLORS: Record<FlowRow["status"], string> = {
  draft: "border-slate-700 bg-slate-800 text-slate-300",
  active: "border-emerald-600/40 bg-emerald-500/10 text-emerald-300",
  archived: "border-slate-700 bg-slate-800/50 text-slate-500",
};

interface ModeloSummary {
  slug: string;
  name: string;
  description: string;
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: string;
  node_count: number;
}

const TEMPLATE_ICONS = {
  MessageSquare,
  HelpCircle,
  UserPlus,
} as const;

export default function FlowsPage() {
  const router = useRouter();
  const canCriar = useCan("send-messages");
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createAberto, setCriarAberto] = useState(false);
  const [newNome, setNovoNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [templates, setModelos] = useState<ModeloSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [flowsRes, tmplRes] = await Promise.all([
          fetch("/api/flows"),
          fetch("/api/flows/templates"),
        ]);
        if (!flowsRes.ok) {
          throw new Erro(`Falhou to load flows: ${flowsRes.status}`);
        }
        const flowsJson = (await flowsRes.json()) as { flows: FlowRow[] };
        if (!cancelled) setFlows(flowsJson.flows ?? []);
        // Modelos endpoint is forward-looking — if it 404s on an
        // older deployment, gracefully fall through.
        if (tmplRes.ok) {
          const tmplJson = (await tmplRes.json()) as {
            templates: ModeloSummary[];
          };
          if (!cancelled) setModelos(tmplJson.templates ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error("Couldn't load flows.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCriar() {
    if (!newNome.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newNome.trim(),
          trigger_type: "keyword",
          trigger_config: { keywords: [] },
        }),
      });
      if (!res.ok) throw new Erro(`Criar failed: ${res.status}`);
      const json = (await res.json()) as { flow: FlowRow };
      setCriarAberto(false);
      setNovoNome("");
      router.push(`/flows/${json.flow.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create flow.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUseModelo(slug: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_slug: slug }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Erro(json.error ?? `Clone failed: ${res.status}`);
      }
      const json = (await res.json()) as { flow: FlowRow };
      setCriarAberto(false);
      router.push(`/flows/${json.flow.id}`);
    } catch (err) {
      const msg = err instanceof Erro ? err.message : "Clone failed";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleExcluir(flow: FlowRow) {
    const yes = window.confirm(
      `Excluir "${flow.name}"? Any active runs will end immediately.`,
    );
    if (!yes) return;
    try {
      const res = await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
      if (!res.ok) throw new Erro(`Excluir failed: ${res.status}`);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      toast.success("Flow deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete flow.");
    }
  }

  if (loading) {
    return (
      <div classNome="flex h-full items-center justify-center">
        <Loader2 classNome="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div classNome="space-y-6 p-6">
      <header classNome="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div classNome="flex items-center gap-2">
            <h1 classNome="text-2xl font-semibold text-white">Flows</h1>
            <span classNome="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              Beta
            </span>
          </div>
          <p classNome="mt-1 text-sm text-slate-400">
            Build branching, button-driven WhatsApp conversations. Useful for
            menus, FAQs, and triage before a human steps in.
          </p>
        </div>
        <GatedButton
          canAct={canCriar}
          gateReason="create flows"
          onClick={() => setCriarAberto(true)}
        >
          <Plus classNome="h-4 w-4" />
          Novo flow
        </GatedButton>
      </header>

      {flows.length === 0 ? (
        <EmptyState
          onCriar={() => setCriarAberto(true)}
          canCriar={canCriar}
        />
      ) : (
        <div classNome="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onEditar={() => router.push(`/flows/${flow.id}`)}
              onExcluir={() => handleExcluir(flow)}
            />
          ))}
        </div>
      )}

      <Dialog open={createAberto} onAbertoChange={setCriarAberto}>
        {/* `sm:max-w-4xl` not `max-w-4xl` — shadcn's DialogContent has
            `sm:max-w-sm` baked into its default classes. Without the
            sm: prefix our override applies at base only and the
            sm-scoped 384px wins at every real desktop breakpoint. */}
        <DialogContent classNome="sm:max-w-4xl bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Criar a new flow</DialogTitle>
            <DialogDescription classNome="text-slate-400">
              Start from a template or build from scratch.
            </DialogDescription>
          </DialogHeader>

          {templates.length > 0 && (
            <div classNome="space-y-3">
              <p classNome="text-xs uppercase tracking-wide text-slate-500">
                Start from a template
              </p>
              <div classNome="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => {
                  const Icon = TEMPLATE_ICONS[t.icon] ?? FileText;
                  return (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => handleUseModelo(t.slug)}
                      disabled={creating}
                      classNome="flex flex-col gap-2.5 rounded-lg border border-slate-800 bg-slate-950 p-4 text-left transition-colors hover:border-primary/40 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Icon classNome="h-5 w-5 text-primary" />
                      <span classNome="text-sm font-semibold text-white">
                        {t.name}
                      </span>
                      <span classNome="text-xs leading-relaxed text-slate-400">
                        {t.description}
                      </span>
                      <span classNome="mt-auto border-t border-slate-800 pt-2 text-[11px] text-slate-500">
                        {t.node_count} {t.node_count === 1 ? "node" : "nodes"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div classNome="space-y-2 border-t border-slate-800 pt-4">
            <p classNome="text-xs uppercase tracking-wide text-slate-500">
              Or start blank
            </p>
            <Input
              value={newNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="e.g. Welcome menu"
              classNome="bg-slate-800"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCriar();
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCriarAberto(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={!newNome.trim() || creating}>
              {creating && <Loader2 classNome="h-4 w-4 animate-spin" />}
              Criar blank flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({
  onCriar,
  canCriar,
}: {
  onCriar: () => void;
  canCriar: boolean;
}) {
  return (
    <div classNome="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-6 py-16 text-center">
      <div classNome="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
        <Workflow classNome="h-6 w-6 text-slate-500" />
      </div>
      <h2 classNome="mt-4 text-base font-medium text-white">
        No flows yet
      </h2>
      <p classNome="mt-1 max-w-md text-sm text-slate-400">
        Build your first conversation — a welcome menu, an order lookup, an FAQ
        bot. Customers tap buttons; the bot routes them to the right answer (or
        the right agent).
      </p>
      <GatedButton
        canAct={canCriar}
        gateReason="create flows"
        onClick={onCriar}
        classNome="mt-5"
      >
        <Plus classNome="h-4 w-4" />
        Criar your first flow
      </GatedButton>
    </div>
  );
}

function FlowCard({
  flow,
  onEditar,
  onExcluir,
}: {
  flow: FlowRow;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const triggerSummary = describeGatilho(flow);
  const StatusIcon =
    flow.status === "active"
      ? PlayCircle
      : flow.status === "archived"
        ? Archive
        : PauseCircle;
  return (
    <div classNome="flex flex-col rounded-lg border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-700">
      <div classNome="flex items-start justify-between gap-2">
        <div classNome="flex min-w-0 items-center gap-2">
          <Workflow classNome="h-4 w-4 shrink-0 text-primary" />
          <h3 classNome="truncate text-sm font-semibold text-white">
            {flow.name}
          </h3>
        </div>
        <Badge
          variant="outline"
          classNome={cn(
            "shrink-0 gap-1 text-[10px]",
            STATUS_COLORS[flow.status],
          )}
        >
          <StatusIcon classNome="h-3 w-3" />
          {STATUS_LABELS[flow.status]}
        </Badge>
      </div>

      <p classNome="mt-2 line-clamp-2 text-xs text-slate-400">
        {flow.description || triggerSummary}
      </p>

      <div classNome="mt-4 flex items-center gap-3 text-[11px] text-slate-500">
        <span classNome="inline-flex items-center gap-1">
          <MessageSquare classNome="h-3 w-3" />
          {flow.execution_count} {flow.execution_count === 1 ? "run" : "runs"}
        </span>
      </div>

      <div classNome="mt-4 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
        <Button variant="ghost" size="sm" onClick={onEditar}>
          <Pencil classNome="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExcluir}
          classNome="text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 classNome="h-3.5 w-3.5" />
          Excluir
        </Button>
      </div>
    </div>
  );
}

function describeGatilho(flow: FlowRow): string {
  if (flow.trigger_type === "keyword") {
    const keywords = Array.isArray(flow.trigger_config.keywords)
      ? (flow.trigger_config.keywords as string[])
      : [];
    if (keywords.length === 0) return "Gatilhos on keyword (none set)";
    return `Gatilhos on: ${keywords.join(", ")}`;
  }
  if (flow.trigger_type === "first_inbound_message") {
    return "Gatilhos on a contact's first-ever inbound message";
  }
  return "Manual trigger";
}
