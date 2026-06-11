"use client";

import { useMemo } from "react";
import type { Deal, PipelineEtapa } from "@/types";
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Trophy,
  XCircle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipGatilho,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";

interface PipelineAnalyticsProps {
  stages: PipelineEtapa[];
  deals: Deal[];
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Ganho) = 100%. Perdido deals excluded.
 */
function computeEtapaProbability(
  stage: PipelineEtapa,
  sortedEtapas: PipelineEtapa[],
): number {
  const n = sortedEtapas.length;
  if (n <= 1) return 1;
  const index = sortedEtapas.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const { defaultCurrency } = useAuth();
  const sortedEtapas = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stats = useMemo(() => {
    const active = deals.filter((d) => d.status !== "lost");
    const openDeals = active.filter((d) => d.status !== "won");

    const totalCount = active.length;
    const totalValor = active.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValor = totalCount > 0 ? totalValor / totalCount : 0;

    const stageById = new Map(sortedEtapas.map((s) => [s.id, s]));
    const weightedValor = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeEtapaProbability(stage, sortedEtapas);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (d: Deal) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };
    const wonThisMonth = deals.filter(
      (d) => d.status === "won" && thisMonth(d),
    ).length;
    const lostThisMonth = deals.filter(
      (d) => d.status === "lost" && thisMonth(d),
    ).length;

    return {
      totalCount,
      totalValor,
      avgValor,
      weightedValor,
      wonThisMonth,
      lostThisMonth,
    };
  }, [deals, sortedEtapas]);

  return (
    <TooltipProvider>
      <div classNome="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3 xl:grid-cols-6">
        <Metric
          icon={<BarChart3 classNome="h-4 w-4 text-slate-400" />}
          label="Total Deals"
          value={String(stats.totalCount)}
          tooltip="Count of every deal in this pipeline that isn't marked as Perdido. Ganho deals are still included."
        />
        <Metric
          icon={<DollarSign classNome="h-4 w-4 text-primary" />}
          label="Pipeline Valor"
          value={formatCurrency(stats.totalValor, defaultCurrency)}
          tooltip="Sum of the dollar values of all deals in this pipeline, excluding deals marked as Perdido."
        />
        <Metric
          icon={<Target classNome="h-4 w-4 text-blue-400" />}
          label="Avg Deal Size"
          value={formatCurrency(stats.avgValor, defaultCurrency)}
          tooltip="Pipeline Valor divided by Total Deals — the average value of a single non-lost deal."
        />
        <Metric
          icon={<TrendingUp classNome="h-4 w-4 text-purple-400" />}
          label="Weighted Valor"
          value={formatCurrency(stats.weightedValor, defaultCurrency)}
          tooltip="Expected revenue: each open deal's value × its stage probability. First stage ≈ 10%, stages progress up to 90%, Ganho = 100%. Perdido deals are excluded."
        />
        <Metric
          icon={<Trophy classNome="h-4 w-4 text-primary" />}
          label="Ganho This Month"
          value={String(stats.wonThisMonth)}
          tooltip="Deals marked as Ganho since the first day of the current month."
        />
        <Metric
          icon={<XCircle classNome="h-4 w-4 text-red-400" />}
          label="Perdido This Month"
          value={String(stats.lostThisMonth)}
          tooltip="Deals marked as Perdido since the first day of the current month."
        />
      </div>
    </TooltipProvider>
  );
}

function Metric({
  icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div classNome="rounded-lg bg-slate-800/50 p-3">
      <div classNome="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {icon}
        <span>{label}</span>
        <Tooltip>
          <TooltipGatilho
            render={
              <button
                type="button"
                aria-label={`How ${label} is calculated`}
                classNome="ml-auto text-slate-500 hover:text-slate-300 focus:outline-none"
              />
            }
          >
            <Info classNome="h-3 w-3" />
          </TooltipGatilho>
          <TooltipContent side="top" classNome="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <p classNome="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
