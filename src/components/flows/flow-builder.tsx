"use client";

/**
 * Linear-list flow editor.
 *
 * Renders the trigger panel, entry-node picker, and the per-node card
 * list. Header and validation panel are NOT owned here — they live
 * once in FlowEditarorShell so they show in both views (lifted in PR 3
 * so canvas users can also save + see validator issues).
 *
 * State lives in the shared `useFlowEditaror()` context — toggling
 * Canvas ⇄ List never loses edits, and a drag on the canvas updates
 * the same nodes the list view reads.
 *
 * What's still local: the `expanded` set (which cards are open) and
 * the scroll refs used when the validator's flashKey changes — those
 * are list-only and have no canvas analogue.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Selecionar,
  SelecionarContent,
  SelecionarItem,
  SelecionarGatilho,
  SelecionarValor,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGatilho,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type ValidationIssue } from "@/lib/flows/validate";
import {
  NODE_META,
  slugify,
  summarizeNode,
  type BuilderNode,
  type NodeType,
} from "./shared";
import { NodeConfigForm } from "./forms/node-config-form";
import { NodeKeySelecionar } from "./forms/fields";
import { IssueLine } from "./validation-panel";
import {
  useFlowEditaror,
  type BuilderState,
} from "./flow-editor-state";

// ============================================================
// Local state shape — mirrors the DB but the configs are typed
// loosely (Record<string, unknown>) since each node_type carries a
// different shape. The sub-form components narrow as needed.
// ============================================================

// ============================================================
// Root component
// ============================================================

export function FlowBuilder() {
  const {
    state,
    setState,
    issues,
    flashKey,
    addNode: addNodeCtx,
    updateNode,
    updateNodeConfig,
    removeNode: removeNodeCtx,
  } = useFlowEditaror();

  // List-only UI state: which cards are expanded + scroll refs for
  // jump-to-node. The flash itself is read from context (flashKey)
  // so canvas + list share the same source of truth.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(state.nodes.map((n) => n.node_key)),
  );
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Wrap addNode so the new node opens expanded in the list view
  // (matches the previous behaviour where adding always revealed the
  // new card so the user could start editing immediately).
  const addNode = useCallback(
    (type: NodeType) => {
      const key = addNodeCtx(type);
      setExpanded((prev) => new Set([...prev, key]));
    },
    [addNodeCtx],
  );

  const removeNode = useCallback(
    (key: string) => {
      removeNodeCtx(key);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [removeNodeCtx],
  );

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setNodeRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) nodeRefs.current.set(key, el);
      else nodeRefs.current.delete(key);
    },
    [],
  );

  // React to validator jumps via the shared flashKey. We DERIVE the
  // expanded-with-flash set (avoids the "setState inside effect"
  // smell of mutating `expanded` from a useEffect on flashKey), then
  // run a side-effect-only effect to scroll the row into view. The
  // flash class is rendered by NodeCard when its key matches
  // flashKey; the flash auto-clears in the context so no timer here.
  const expandedWithFlash = useMemo(() => {
    if (!flashKey || expanded.has(flashKey)) return expanded;
    return new Set([...expanded, flashKey]);
  }, [expanded, flashKey]);
  useEffect(() => {
    if (!flashKey) return;
    // requestAnimationFrame defers the scroll until after React has
    // committed any expand-induced layout shift.
    requestAnimationFrame(() => {
      const el = nodeRefs.current.get(flashKey);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [flashKey]);

  return (
    <div classNome="flex flex-col gap-6">
      <GatilhoPanel
        state={state}
        setState={setState}
        triggerIssues={issues.filter((i) => i.scope === "trigger")}
      />

      <EntryPicker state={state} setState={setState} />

      <section classNome="flex flex-col gap-3">
        <div classNome="flex items-center justify-between">
          <h2 classNome="text-sm font-semibold text-white">
            Nodes ({state.nodes.length})
          </h2>
          <AdicionarNodeButton onAdicionar={addNode} />
        </div>

        {state.nodes.length === 0 ? (
          <div classNome="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
            Adicionar a <strong>Start</strong> node, then a <strong>Enviar buttons</strong>
            {" "}node, then a <strong>Handoff</strong> — that&apos;s the welcome-menu
            shape from the brief.
          </div>
        ) : (
          state.nodes.map((node) => (
            <NodeCard
              key={node.node_key}
              node={node}
              allNodes={state.nodes}
              expanded={expandedWithFlash.has(node.node_key)}
              isEntry={state.entry_node_id === node.node_key}
              isFlashed={flashKey === node.node_key}
              cardRef={setNodeRef(node.node_key)}
              issues={issues.filter(
                (i) => i.scope === "node" && i.node_key === node.node_key,
              )}
              onToggle={() => toggleExpanded(node.node_key)}
              onUpdate={(patch) => updateNode(node.node_key, patch)}
              onUpdateConfig={(patch) => updateNodeConfig(node.node_key, patch)}
              onRemover={() => removeNode(node.node_key)}
              onSetEntry={() =>
                setState((s) => ({ ...s, entry_node_id: node.node_key }))
              }
            />
          ))
        )}
      </section>
    </div>
  );
}


// ============================================================
// Gatilho panel
// ============================================================

function GatilhoPanel({
  state,
  setState,
  triggerIssues,
}: {
  state: BuilderState;
  setState: React.Dispatch<React.SetStateAção<BuilderState>>;
  triggerIssues: ValidationIssue[];
}) {
  return (
    <section classNome="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 classNome="mb-3 text-sm font-semibold text-white">Gatilho</h2>
      <div classNome="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label classNome="mb-1 block text-xs text-slate-400">When…</label>
          <Selecionar
            value={state.trigger_type}
            onValorChange={(v) =>
              setState((s) => ({
                ...s,
                trigger_type: v as BuilderState["trigger_type"],
                trigger_config:
                  v === "keyword" ? { keywords: [] } : v === "manual" ? {} : {},
              }))
            }
          >
            <SelecionarGatilho classNome="bg-slate-800">
              <SelecionarValor />
            </SelecionarGatilho>
            <SelecionarContent>
              <SelecionarItem value="keyword">
                A message contains a keyword
              </SelecionarItem>
              <SelecionarItem value="first_inbound_message">
                Customer&apos;s first ever inbound message
              </SelecionarItem>
              <SelecionarItem value="manual">
                Manual only (no auto-trigger)
              </SelecionarItem>
            </SelecionarContent>
          </Selecionar>
        </div>
        {state.trigger_type === "keyword" && (
          <div>
            <label classNome="mb-1 block text-xs text-slate-400">
              Keywords (comma-separated)
            </label>
            <Input
              value={
                Array.isArray(state.trigger_config.keywords)
                  ? (state.trigger_config.keywords as string[]).join(", ")
                  : ""
              }
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  trigger_config: {
                    ...s.trigger_config,
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder="support, help, hi"
              classNome="bg-slate-800"
            />
          </div>
        )}
      </div>
      {triggerIssues.length > 0 && (
        <div classNome="mt-3 flex flex-col gap-1">
          {triggerIssues.map((i, ix) => (
            <IssueLine key={ix} issue={i} />
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// Entry-node picker
// ============================================================

function EntryPicker({
  state,
  setState,
}: {
  state: BuilderState;
  setState: React.Dispatch<React.SetStateAção<BuilderState>>;
}) {
  if (state.nodes.length === 0) return null;
  return (
    <section classNome="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <CornerDownRight classNome="h-4 w-4 shrink-0 text-primary" />
      <span classNome="text-xs text-slate-400">Entry node:</span>
      <NodeKeySelecionar
        value={state.entry_node_id}
        nodes={state.nodes}
        onChange={(key) =>
          setState((s) => ({ ...s, entry_node_id: key }))
        }
        placeholder="Pick the first node…"
        classNome="flex-1 max-w-xs"
      />
    </section>
  );
}

// ============================================================
// Node card — collapsed summary + expanded config form
// ============================================================

function NodeCard({
  node,
  allNodes,
  expanded,
  isEntry,
  isFlashed,
  cardRef,
  issues,
  onToggle,
  onUpdate,
  onUpdateConfig,
  onRemover,
  onSetEntry,
}: {
  node: BuilderNode;
  allNodes: BuilderNode[];
  expanded: boolean;
  isEntry: boolean;
  isFlashed: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  issues: ValidationIssue[];
  onToggle: () => void;
  onUpdate: (patch: Partial<BuilderNode>) => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onRemover: () => void;
  onSetEntry: () => void;
}) {
  const meta = NODE_META[node.node_type];
  const hasErro = issues.some((i) => i.severity === "error");
  const preview = summarizeNode(node);
  return (
    <div
      ref={cardRef}
      classNome={cn(
        "rounded-lg border bg-slate-900 transition-shadow duration-500",
        hasErro
          ? "border-red-500/40"
          : isEntry
            ? "border-primary/50"
            : "border-slate-800",
        isFlashed &&
          "ring-2 ring-primary ring-offset-2 ring-offset-slate-950",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        classNome="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <meta.icon classNome={cn("h-4 w-4 shrink-0", meta.color)} />
        <div classNome="min-w-0 flex-1">
          <div classNome="flex items-center gap-2">
            <span classNome="truncate text-sm font-medium text-white">
              {meta.label}
            </span>
            <code classNome="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {node.node_key}
            </code>
            {isEntry && (
              <Badge
                variant="outline"
                classNome="border-primary/40 bg-primary/10 text-[10px] text-primary"
              >
                Entry
              </Badge>
            )}
          </div>
          {!expanded && preview && (
            <p classNome="mt-0.5 truncate text-xs text-slate-500">
              {preview}
            </p>
          )}
        </div>
        {hasErro && (
          <CircleAlert classNome="h-3.5 w-3.5 shrink-0 text-red-400" />
        )}
        {expanded ? (
          <ChevronUp classNome="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown classNome="h-4 w-4 text-slate-500" />
        )}
      </button>
      {expanded && (
        <div classNome="border-t border-slate-800 px-4 py-4">
          <NodeConfigWithAdvanced
            node={node}
            allNodes={allNodes}
            onUpdate={onUpdate}
            onUpdateConfig={onUpdateConfig}
          />
          <div classNome="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
            <div classNome="flex items-center gap-2">
              {!isEntry && (
                <Button variant="ghost" size="sm" onClick={onSetEntry}>
                  Set as entry
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemover}
              classNome="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 classNome="h-3.5 w-3.5" />
              Remover node
            </Button>
          </div>
          {issues.length > 0 && (
            <div classNome="mt-3 flex flex-col gap-1 rounded-md bg-red-500/5 p-2">
              {issues.map((i, ix) => (
                <IssueLine key={ix} issue={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Per-node-type config form — wraps the extracted dispatcher with
// the list-view's "Show advanced" disclosure (which exposes the
// internal node_key for stable analytics, hidden by default).
// ============================================================

function NodeConfigWithAdvanced({
  node,
  allNodes,
  onUpdate,
  onUpdateConfig,
}: {
  node: BuilderNode;
  allNodes: BuilderNode[];
  onUpdate: (patch: Partial<BuilderNode>) => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasReplyIds =
    node.node_type === "send_buttons" || node.node_type === "send_list";
  return (
    <div classNome="flex flex-col gap-3">
      <NodeConfigForm
        node={node}
        allNodes={allNodes}
        showAdvanced={showAdvanced}
        onUpdateConfig={onUpdateConfig}
      />
      <div classNome="border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          classNome="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
        >
          {showAdvanced ? (
            <ChevronUp classNome="h-3 w-3" />
          ) : (
            <ChevronDown classNome="h-3 w-3" />
          )}
          {showAdvanced ? "Hide" : "Show"} advanced
        </button>
        {showAdvanced && (
          <div classNome="mt-3 flex flex-col gap-3">
            <div>
              <label classNome="mb-1 block text-xs text-slate-400">
                Node key (internal identifier — keep stable for analytics)
              </label>
              <Input
                value={node.node_key}
                onChange={(e) =>
                  onUpdate({ node_key: slugify(e.target.value, node.node_key) })
                }
                classNome="bg-slate-800 font-mono text-xs"
              />
            </div>
            {hasReplyIds && (
              <p classNome="text-[10px] text-slate-500">
                Reply IDs for each option are shown inline above. They&apos;re
                returned by WhatsApp when a customer taps; you usually don&apos;t
                need to touch them.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// Adicionar-node menu
// ============================================================

function AdicionarNodeButton({ onAdicionar }: { onAdicionar: (type: NodeType) => void }) {
  const types: NodeType[] = [
    "start",
    "send_buttons",
    "send_list",
    "send_message",
    "send_media",
    "collect_input",
    "condition",
    "set_tag",
    "handoff",
    "end",
  ];
  return (
    <DropdownMenu>
      <DropdownMenuGatilho
        classNome="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
        aria-label="Adicionar node"
      >
        <Plus classNome="h-3.5 w-3.5" />
        Adicionar node
      </DropdownMenuGatilho>
      <DropdownMenuContent align="end" classNome="border-slate-700 bg-slate-900">
        {types.map((t) => {
          const meta = NODE_META[t];
          return (
            <DropdownMenuItem key={t} onClick={() => onAdicionar(t)}>
              <meta.icon classNome={cn("h-3.5 w-3.5", meta.color)} />
              {meta.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

