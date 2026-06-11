"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import type { Pipeline, PipelineEtapa } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rótulo } from "@/components/ui/label";
import {
  Trash2,
  Plus,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const STAGE_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
];

interface PipelineSettingsProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  pipeline: Pipeline;
  stages: PipelineEtapa[];
  onFunisChanged: () => void;
  onEtapasChanged: () => void;
  onCriarNovoPipeline: () => void;
}

export function PipelineSettings({
  open,
  onAbertoChange,
  pipeline,
  stages,
  onFunisChanged,
  onEtapasChanged,
  onCriarNovoPipeline,
}: PipelineSettingsProps) {
  const supabase = createClient();

  const [name, setNome] = useState(pipeline.name);
  const [localEtapas, setLocalEtapas] = useState<PipelineEtapa[]>(stages);
  const [newEtapaNome, setNovoEtapaNome] = useState("");
  const [newEtapaCor, setNovoEtapaCor] = useState(STAGE_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [showExcluirConfirmar, setShowExcluirConfirmar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form state when the dialog opens or its prop inputs change
  // — legitimate prop-driven sync.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setNome(pipeline.name);
    setLocalEtapas([...stages].sort((a, b) => a.position - b.position));
    setShowExcluirConfirmar(false);
  }, [open, pipeline, stages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localEtapas.findIndex((s) => s.id === active.id);
    const newIndex = localEtapas.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setLocalEtapas(arrayMove(localEtapas, oldIndex, newIndex));
  }

  async function handleSalvar() {
    setSaving(true);

    // One upsert for all stages — batches N stage writes into a single
    // round-trip. Anterior implementation did N sequential UPDATEs which
    // latency-scaled linearly with stage count.
    const stageRows = localEtapas.map((s, i) => ({
      id: s.id,
      pipeline_id: s.pipeline_id,
      name: s.name,
      color: s.color,
      position: i,
    }));

    const [renameRes, stagesRes] = await Promise.all([
      supabase
        .from("pipelines")
        .update({ name: name.trim() })
        .eq("id", pipeline.id),
      supabase.from("pipeline_stages").upsert(stageRows, { onConflict: "id" }),
    ]);

    setSaving(false);

    if (renameRes.error || stagesRes.error) {
      toast.error("Falhou to save pipeline");
      return;
    }

    onAbertoChange(false);
    onFunisChanged();
    onEtapasChanged();
    toast.success("Pipeline saved");
  }

  async function handleAdicionarEtapa() {
    const trimmed = newEtapaNome.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert({
        pipeline_id: pipeline.id,
        name: trimmed,
        color: newEtapaCor,
        position: localEtapas.length,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error("Falhou to add stage");
      return;
    }
    setLocalEtapas([...localEtapas, data as PipelineEtapa]);
    setNovoEtapaNome("");
    setNovoEtapaCor(STAGE_COLORS[(localEtapas.length + 1) % STAGE_COLORS.length]);
  }

  async function handleRemoverEtapa(stageId: string) {
    // Refuse to delete if deals still reference the stage (FK would fail).
    const { count } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", stageId);
    if (count && count > 0) {
      toast.error("Move or delete deals in this stage first");
      return;
    }
    const { error } = await supabase
      .from("pipeline_stages")
      .delete()
      .eq("id", stageId);
    if (error) {
      toast.error("Falhou to delete stage");
      return;
    }
    setLocalEtapas(localEtapas.filter((s) => s.id !== stageId));
  }

  async function handleExcluirPipeline() {
    setDeleting(true);
    // ON DELETE CASCADE handles deals + stages.
    const { error } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", pipeline.id);
    setDeleting(false);
    if (error) {
      toast.error("Falhou to delete pipeline");
      return;
    }
    onAbertoChange(false);
    onFunisChanged();
    toast.success("Pipeline deleted");
  }

  return (
    <Dialog open={open} onAbertoChange={onAbertoChange}>
      <DialogContent classNome="sm:max-w-md bg-slate-900 border-slate-700 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle classNome="text-white">Manage Pipeline</DialogTitle>
        </DialogHeader>

        {showExcluirConfirmar ? (
          <div classNome="py-4">
            <div classNome="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <AlertTriangle classNome="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p classNome="text-sm font-medium text-red-400">
                  Excluir Pipeline
                </p>
                <p classNome="mt-1 text-xs text-slate-400">
                  This will archive all deals in this pipeline. This cannot be
                  undone.
                </p>
              </div>
            </div>
            <div classNome="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowExcluirConfirmar(false)}
                classNome="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleExcluirPipeline}
                disabled={deleting}
                classNome="bg-red-600 text-white hover:bg-red-700"
              >
                {deleting ? "Deleting..." : "Excluir Pipeline"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div classNome="grid gap-4 py-2">
              <div classNome="grid gap-2">
                <Rótulo classNome="text-slate-300">Pipeline Nome</Rótulo>
                <Input
                  value={name}
                  onChange={(e) => setNome(e.target.value)}
                  classNome="border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div classNome="grid gap-2">
                <Rótulo classNome="text-slate-300">Etapas</Rótulo>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleReorder}
                >
                  <SortableContext
                    items={localEtapas.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div classNome="space-y-2">
                      {localEtapas.map((stage, index) => (
                        <OrdenarableEtapaRow
                          key={stage.id}
                          stage={stage}
                          onNomeChange={(v) => {
                            const updated = [...localEtapas];
                            updated[index] = { ...updated[index], name: v };
                            setLocalEtapas(updated);
                          }}
                          onCorChange={(v) => {
                            const updated = [...localEtapas];
                            updated[index] = { ...updated[index], color: v };
                            setLocalEtapas(updated);
                          }}
                          onRemover={() => handleRemoverEtapa(stage.id)}
                          colors={STAGE_COLORS}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Adicionar new stage */}
                <div classNome="mt-1 flex flex-wrap gap-1">
                  {STAGE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNovoEtapaCor(color)}
                      classNome="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundCor: color,
                        borderCor:
                          newEtapaCor === color ? "white" : "transparent",
                      }}
                      aria-label={`Pick color ${color}`}
                    />
                  ))}
                </div>
                <div classNome="flex items-center gap-2">
                  <Input
                    value={newEtapaNome}
                    onChange={(e) => setNovoEtapaNome(e.target.value)}
                    placeholder="Novo stage name"
                    classNome="border-slate-700 bg-slate-800 text-sm text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdicionarEtapa();
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAdicionarEtapa}
                    disabled={!newEtapaNome.trim()}
                    classNome="shrink-0 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
                  >
                    <Plus classNome="mr-1 h-3 w-3" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={onCriarNovoPipeline}
                classNome="w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              >
                <Plus classNome="mr-1 h-3 w-3" />
                Criar a new pipeline
              </Button>
            </div>

            <DialogFooter classNome="border-slate-700 bg-slate-900/50">
              <Button
                variant="destructive"
                onClick={() => setShowExcluirConfirmar(true)}
                classNome="mr-auto bg-red-600 hover:bg-red-700"
              >
                Excluir Pipeline
              </Button>
              <Button
                variant="outline"
                onClick={() => onAbertoChange(false)}
                classNome="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={saving || !name.trim()}
                classNome="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? "Salvando..." : "Salvar Changes"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrdenarableEtapaRow({
  stage,
  onNomeChange,
  onCorChange,
  onRemover,
  colors,
}: {
  stage: PipelineEtapa;
  onNomeChange: (v: string) => void;
  onCorChange: (v: string) => void;
  onRemover: () => void;
  colors: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      classNome="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        classNome="cursor-grab touch-none text-slate-500 hover:text-slate-300 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical classNome="h-4 w-4" />
      </button>
      <CorSwatch value={stage.color} onChange={onCorChange} colors={colors} />
      <Input
        value={stage.name}
        onChange={(e) => onNomeChange(e.target.value)}
        classNome="h-7 flex-1 border-transparent bg-transparent text-sm text-white focus:border-slate-600"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemover}
        classNome="text-slate-400 hover:text-red-400"
      >
        <Trash2 classNome="h-3 w-3" />
      </Button>
    </div>
  );
}

function CorSwatch({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: string[];
}) {
  const [open, setAberto] = useState(false);
  return (
    <div classNome="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        classNome="h-4 w-4 rounded-full border border-slate-600"
        style={{ backgroundCor: value }}
        aria-label="Change color"
      />
      {open && (
        <>
          <div classNome="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div classNome="absolute left-0 top-6 z-20 flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-lg w-36">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setAberto(false);
                }}
                classNome="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundCor: c,
                  borderCor: c === value ? "white" : "transparent",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
