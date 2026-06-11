"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Pipeline, PipelineEtapa, Deal } from "@/types";
import { PipelineBoard } from "@/components/pipelines/pipeline-board";
import { PipelineSettings } from "@/components/pipelines/pipeline-settings";
import { DealForm } from "@/components/pipelines/deal-form";
import { PipelineAnalytics } from "@/components/pipelines/pipeline-analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGatilho,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Rótulo } from "@/components/ui/label";
import { GitBranch, Plus, ChevronDown, Settings } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { useAuth } from "@/hooks/use-auth";
import { GatedButton } from "@/components/ui/gated-button";

// Pipeline creation is admin-class (settings-tier write under
// the new RLS); deal creation is operational and only requires
// agent+. The two CTAs gate on different `useCan` capabilities,
// not on different copy.

// Spec-defined seed — name and color per the product spec.
const SPEC_DEFAULT_STAGES = [
  { name: "Novo Lead", color: "#3b82f6", position: 0 }, // blue
  { name: "Qualified", color: "#eab308", position: 1 }, // yellow
  { name: "Proposal Enviado", color: "#f97316", position: 2 }, // orange
  { name: "Negotiation", color: "#8b5cf6", position: 3 }, // purple
  { name: "Ganho", color: "#22c55e", position: 4 }, // green
];

export default function FunisPage() {
  const supabase = createClient();
  const canEditarSettings = useCan("edit-settings");
  const canCriarDeals = useCan("send-messages");
  const { accountId } = useAuth();

  const [pipelines, setFunis] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelecionaredPipelineId] = useState<string>("");
  const [stages, setEtapas] = useState<PipelineEtapa[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog / sheet state
  const [newPipelineAberto, setNovoPipelineAberto] = useState(false);
  const [newPipelineNome, setNovoPipelineNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [settingsAberto, setSettingsAberto] = useState(false);

  // Deal form state is lifted here so both the top-bar "Adicionar Deal" and
  // the per-column "+" trigger the same Sheet.
  const [dealFormAberto, setDealFormAberto] = useState(false);
  const [editingDeal, setEditaringDeal] = useState<Deal | null>(null);
  const [defaultEtapaId, setDefaultEtapaId] = useState<string>("");

  // Guard against double-seeding (React StrictMode double-effect in dev).
  const seedAttempted = useRef(false);

  const loadFunis = useCallback(async () => {
    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .order("created_at");
    if (error) {
      console.error("Falhou to load pipelines:", error.message);
      return [];
    }
    return data ?? [];
  }, [supabase]);

  const loadEtapas = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position");
      return data ?? [];
    },
    [supabase],
  );

  const loadDeals = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("deals")
        .select("*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Deal[];
    },
    [supabase],
  );

  const seedDefaultPipeline = useCallback(async (): Promise<Pipeline | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    // pipelines.account_id is NOT NULL post-017 with no DB default.
    if (!accountId) return null;

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, account_id: accountId, name: "Sales Pipeline" })
      .select()
      .single();

    if (error || !pipeline) {
      console.error("Falhou to seed pipeline:", error?.message);
      return null;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    return pipeline as Pipeline;
  }, [supabase, accountId]);

  // Initial load + seed-if-empty
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let list = await loadFunis();

      if (list.length === 0 && !seedAttempted.current) {
        seedAttempted.current = true;
        const seeded = await seedDefaultPipeline();
        if (seeded) list = await loadFunis();
      }

      if (cancelled) return;
      setFunis(list);
      if (list.length > 0) {
        setSelecionaredPipelineId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0].id,
        );
      } else {
        setSelecionaredPipelineId("");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFunis, seedDefaultPipeline]);

  // Load stages + deals whenever selected pipeline changes.
  // Clearing on no-selection is a legitimate sync with URL/prop
  // state; the load completion uses async setters inside promise
  // callbacks (not synchronous in the effect body).
  useEffect(() => {
    if (!selectedPipelineId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEtapas([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [s, d] = await Promise.all([
        loadEtapas(selectedPipelineId),
        loadDeals(selectedPipelineId),
      ]);
      if (cancelled) return;
      setEtapas(s);
      setDeals(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPipelineId, loadEtapas, loadDeals]);

  const refreshFunis = useCallback(async () => {
    const list = await loadFunis();
    setFunis(list);
    if (list.length === 0) setSelecionaredPipelineId("");
    else if (!list.some((p) => p.id === selectedPipelineId))
      setSelecionaredPipelineId(list[0].id);
  }, [loadFunis, selectedPipelineId]);

  const refreshEtapas = useCallback(async () => {
    if (!selectedPipelineId) return;
    setEtapas(await loadEtapas(selectedPipelineId));
  }, [loadEtapas, selectedPipelineId]);

  const refreshDeals = useCallback(async () => {
    if (!selectedPipelineId) return;
    setDeals(await loadDeals(selectedPipelineId));
  }, [loadDeals, selectedPipelineId]);

  const handleDealMoved = useCallback(
    async (dealId: string, newEtapaId: string) => {
      // Optimistic update — board already animated; just persist.
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: newEtapaId } : d)),
      );
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: newEtapaId })
        .eq("id", dealId);
      if (error) {
        toast.error("Falhou to move deal");
        refreshDeals();
      }
    },
    [supabase, refreshDeals],
  );

  const handleAdicionarDeal = useCallback(
    (stageId?: string) => {
      setEditaringDeal(null);
      setDefaultEtapaId(stageId ?? stages[0]?.id ?? "");
      setDealFormAberto(true);
    },
    [stages],
  );

  const handleEditarDeal = useCallback((deal: Deal) => {
    setEditaringDeal(deal);
    setDefaultEtapaId(deal.stage_id);
    setDealFormAberto(true);
  }, []);

  async function handleCriarPipeline() {
    const name = newPipelineNome.trim();
    if (!name) return;
    setCreating(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setCreating(false);
      return;
    }
    // pipelines.account_id is NOT NULL post-017 with no DB default.
    if (!accountId) {
      toast.error("Your profile is not linked to an account.");
      setCreating(false);
      return;
    }

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, account_id: accountId, name })
      .select()
      .single();

    if (error || !pipeline) {
      toast.error("Falhou to create pipeline");
      setCreating(false);
      return;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    setNovoPipelineNome("");
    setNovoPipelineAberto(false);
    setSelecionaredPipelineId(pipeline.id);
    await refreshFunis();
    setCreating(false);
    toast.success("Pipeline created");
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  if (loading) {
    return (
      <div classNome="space-y-6">
        <div classNome="flex items-center justify-between">
          <div classNome="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div classNome="h-9 w-28 animate-pulse rounded-lg bg-slate-800" />
        </div>
        <div classNome="flex gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} classNome="h-96 w-72 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div classNome="space-y-6">
      {/* Header */}
      <div classNome="flex flex-wrap items-center justify-between gap-3">
        <div classNome="flex items-center gap-3">
          {/* Pipeline selector dropdown */}
          <DropdownMenu>
            <DropdownMenuGatilho
              classNome="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 transition-colors data-[popup-open]:bg-slate-800"
            >
              <GitBranch classNome="h-4 w-4 text-primary" />
              <span classNome="font-semibold">
                {selectedPipeline?.name ?? "Selecionar Pipeline"}
              </span>
              <ChevronDown classNome="h-4 w-4 text-slate-400" />
            </DropdownMenuGatilho>
            <DropdownMenuContent
              align="start"
              classNome="w-64 border-slate-700 bg-slate-900 text-slate-200"
            >
              {pipelines.length === 0 && (
                <DropdownMenuItem disabled classNome="text-slate-500">
                  Nenhum funil yet
                </DropdownMenuItem>
              )}
              {pipelines.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelecionaredPipelineId(p.id)}
                  classNome={
                    p.id === selectedPipelineId
                      ? "text-primary"
                      : "text-slate-300"
                  }
                >
                  <GitBranch classNome="mr-2 h-3.5 w-3.5" />
                  {p.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator classNome="bg-slate-700" />
              {selectedPipeline && (
                <DropdownMenuItem
                  onClick={() => setSettingsAberto(true)}
                  classNome="text-slate-300"
                >
                  <Settings classNome="mr-2 h-3.5 w-3.5" />
                  Manage Funis
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div classNome="flex items-center gap-2">
          <GatedButton
            variant="outline"
            canAct={canEditarSettings}
            gateReason="create pipelines"
            onClick={() => setNovoPipelineAberto(true)}
            classNome="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <Plus classNome="mr-1 h-4 w-4" />
            Adicionar Pipeline
          </GatedButton>
          <GatedButton
            canAct={canCriarDeals}
            gateReason="create deals"
            disabled={!selectedPipelineId || stages.length === 0}
            onClick={() => handleAdicionarDeal()}
            classNome="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus classNome="mr-1 h-4 w-4" />
            Adicionar Deal
          </GatedButton>
        </div>
      </div>

      {/* Board */}
      {pipelines.length === 0 ? (
        <div classNome="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-20">
          <GitBranch classNome="h-12 w-12 text-slate-600" />
          <h3 classNome="mt-4 text-lg font-medium text-white">
            Nenhum funil yet
          </h3>
          <p classNome="mt-2 text-sm text-slate-400">
            Criar a pipeline to start tracking deals
          </p>
          <GatedButton
            canAct={canEditarSettings}
            gateReason="create pipelines"
            onClick={() => setNovoPipelineAberto(true)}
            classNome="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus classNome="mr-1 h-4 w-4" />
            Criar Pipeline
          </GatedButton>
        </div>
      ) : (
        <>
          <PipelineAnalytics stages={stages} deals={deals} />
          <PipelineBoard
            stages={stages}
            deals={deals}
            onDealMoved={handleDealMoved}
            onAdicionarDeal={handleAdicionarDeal}
            onEditarDeal={handleEditarDeal}
          />
        </>
      )}

      {/* Novo Pipeline Dialog */}
      <Dialog open={newPipelineAberto} onAbertoChange={setNovoPipelineAberto}>
        <DialogContent classNome="sm:max-w-sm bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle classNome="text-white">Novo Pipeline</DialogTitle>
          </DialogHeader>
          <div classNome="py-2">
            <Rótulo classNome="text-slate-300">Pipeline Nome</Rótulo>
            <Input
              value={newPipelineNome}
              onChange={(e) => setNovoPipelineNome(e.target.value)}
              placeholder="e.g., Enterprise Sales"
              classNome="mt-2 bg-slate-800 border-slate-700 text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCriarPipeline();
              }}
            />
            <p classNome="mt-2 text-xs text-slate-400">
              Default stages (Novo Lead → Ganho) will be created automatically.
            </p>
          </div>
          <DialogFooter classNome="bg-slate-900/50 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setNovoPipelineAberto(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriarPipeline}
              disabled={creating || !newPipelineNome.trim()}
              classNome="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? "Creating..." : "Criar Pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Settings */}
      {selectedPipeline && (
        <PipelineSettings
          open={settingsAberto}
          onAbertoChange={setSettingsAberto}
          pipeline={selectedPipeline}
          stages={stages}
          onFunisChanged={refreshFunis}
          onEtapasChanged={refreshEtapas}
          onCriarNovoPipeline={() => {
            setSettingsAberto(false);
            setNovoPipelineAberto(true);
          }}
        />
      )}

      {/* Deal Form (Sheet) */}
      <DealForm
        open={dealFormAberto}
        onAbertoChange={setDealFormAberto}
        deal={editingDeal}
        pipelineId={selectedPipelineId}
        stages={stages}
        defaultEtapaId={defaultEtapaId}
        onSalvard={refreshDeals}
      />
    </div>
  );
}
