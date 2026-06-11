"use client";

/**
 * Reusable field components shared across every per-node form.
 *
 * `NodeKeySelecionar` — picks a node from the flow's node list, rendered
 * with the source node's icon so the dropdown reads as
 * "destination = ◇ menu" rather than an opaque slug.
 *
 * `PróximoNodeRow` — wraps NodeKeySelecionar with a label; the most common
 * per-node form row ("after this node, advance to…").
 *
 * `TextRow` — wraps Input or Textarea behind a label. Pure UI sugar
 * to keep per-node forms uncluttered.
 *
 * Lives in src/components/flows/forms/ so both the list view's
 * collapsed-card editor and the canvas view's side-panel editor
 * (introduced in this PR) mount the exact same form components.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Selecionar,
  SelecionarContent,
  SelecionarItem,
  SelecionarGatilho,
  SelecionarValor,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NODE_META, type BuilderNode } from "../shared";

export function TextRow({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label classNome="mb-1 block text-xs text-slate-400">{label}</label>
      {rows > 1 ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          classNome="bg-slate-800"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          classNome="bg-slate-800"
        />
      )}
    </div>
  );
}

export function PróximoNodeRow({
  value,
  allNodes,
  currentKey,
  onChange,
  label,
}: {
  value: string;
  allNodes: BuilderNode[];
  currentKey: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <label classNome="mb-1 block text-xs text-slate-400">{label}</label>
      <NodeKeySelecionar
        value={value || null}
        nodes={allNodes}
        excludeKey={currentKey}
        onChange={(v) => onChange(v ?? "")}
        placeholder="Pick a next node…"
      />
    </div>
  );
}

export function NodeKeySelecionar({
  value,
  nodes,
  excludeKey,
  onChange,
  placeholder,
  classNome,
}: {
  value: string | null;
  nodes: BuilderNode[];
  excludeKey?: string;
  onChange: (v: string | null) => void;
  placeholder?: string;
  classNome?: string;
}) {
  const options = nodes.filter((n) => n.node_key !== excludeKey);
  return (
    <Selecionar
      value={value ?? "__none__"}
      onValorChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelecionarGatilho classNome={cn("bg-slate-800", classNome)}>
        <SelecionarValor placeholder={placeholder ?? "—"} />
      </SelecionarGatilho>
      <SelecionarContent>
        <SelecionarItem value="__none__">— Nenhum —</SelecionarItem>
        {options.map((n) => {
          const Icon = NODE_META[n.node_type].icon;
          return (
            <SelecionarItem key={n.node_key} value={n.node_key}>
              <span classNome="inline-flex items-center gap-1.5">
                <Icon
                  classNome={cn("h-3 w-3", NODE_META[n.node_type].color)}
                />
                {n.node_key}
              </span>
            </SelecionarItem>
          );
        })}
      </SelecionarContent>
    </Selecionar>
  );
}
