"use client";

import type { Deal, PipelineEtapa } from "@/types";
import { Calendar, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface DealCardProps {
  deal: Deal;
  stage: PipelineEtapa | null;
  onEditar: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEditar, isOverlay }: DealCardProps) {
  const contactRótulo = deal.contact?.name || deal.contact?.phone || "No contact";
  const assigneeRótulo = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEditar(deal);
      }}
      classNome={`group relative w-full cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/70 pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 hover:shadow-lg"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        classNome="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundCor: stage?.color ?? "#94a3b8" }}
      />

      <div classNome="flex items-start justify-between gap-2">
        <h4 classNome="flex-1 text-sm font-semibold leading-snug text-white break-words">
          {deal.title}
        </h4>
        {deal.status === "won" && (
          <span classNome="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Check classNome="h-3 w-3" />
            Ganho
          </span>
        )}
        {deal.status === "lost" && (
          <span classNome="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <X classNome="h-3 w-3" />
            Perdido
          </span>
        )}
      </div>

      {/* Contact row */}
      <div classNome="mt-2 flex items-center gap-2">
        <span classNome="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-200">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <span classNome="truncate text-xs text-slate-400">{contactRótulo}</span>
      </div>

      <div classNome="mt-2 flex items-center justify-between">
        <span classNome="text-sm font-bold text-primary">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {deal.expected_close_date && (
          <span classNome="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar classNome="h-3 w-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {assigneeRótulo && (
        <div classNome="mt-2 flex items-center justify-end">
          <span
            title={assigneeRótulo}
            classNome="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
          >
            {initials(assigneeRótulo)}
          </span>
        </div>
      )}
    </button>
  );
}
