"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Zap,
  Plus,
  MoreVertical,
  Copiar,
  Pencil,
  Trash2,
  FileText,
  MessageCircle,
  Clock,
  Users,
  TelefoneCall,
  Loader2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useCan } from "@/hooks/use-can"
import type { Automation } from "@/types"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGatilho,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AUTOMATION_TEMPLATES, type ModeloSlug } from "@/lib/automations/templates"
import { triggerMeta, formatRelative } from "@/lib/automations/trigger-meta"
import { cn } from "@/lib/utils"

const TEMPLATE_ORDER: ModeloSlug[] = [
  "welcome_message",
  "out_of_office",
  "lead_qualifier",
  "follow_up_reminder",
]

const TEMPLATE_ICON: Record<ModeloSlug, typeof Zap> = {
  welcome_message: MessageCircle,
  out_of_office: Clock,
  lead_qualifier: Users,
  follow_up_reminder: TelefoneCall,
}

export default function AutomaçõesPage() {
  const router = useRouter()
  const canCriar = useCan("send-messages")
  const [automations, setAutomações] = useState<Automation[] | null>(null)
  const [error, setErro] = useState<string | null>(null)
  const [pendingExcluir, setPendingExcluir] = useState<Automation | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false })
      if (fetchErr) throw fetchErr
      setAutomações((data ?? []) as Automation[])
    } catch (err) {
      setErro(err instanceof Erro ? err.message : "Falhou to load automations")
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleAtivo(a: Automation, next: boolean) {
    // Optimistic flip so the switch feels instant.
    setAutomações((prev) =>
      prev?.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)) ?? prev,
    )
    const res = await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      // Roll back on error.
      setAutomações((prev) =>
        prev?.map((x) => (x.id === a.id ? { ...x, is_active: !next } : x)) ?? prev,
      )
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Falhou to update")
      return
    }
    toast.success(next ? "Automation activated" : "Automation paused")
  }

  async function duplicate(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}/duplicate`, { method: "POST" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Falhou to duplicate")
      return
    }
    toast.success("Automation duplicated")
    load()
  }

  async function confirmExcluir() {
    if (!pendingExcluir) return
    setDeleting(true)
    const res = await fetch(`/api/automations/${pendingExcluir.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Falhou to delete")
      return
    }
    toast.success("Automation deleted")
    setPendingExcluir(null)
    load()
  }

  async function startFromModelo(slug: ModeloSlug) {
    router.push(`/automations/new?template=${slug}`)
  }

  if (error) {
    return (
      <div classNome="flex h-64 flex-col items-center justify-center gap-2">
        <p classNome="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (automations === null) {
    return (
      <div classNome="flex h-64 items-center justify-center">
        <Loader2 classNome="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const showModelos = automations.length < 3

  return (
    <div classNome="space-y-6">
      <div classNome="flex items-center justify-between">
        <div>
          <h1 classNome="text-2xl font-bold text-white">Automações</h1>
          <p classNome="mt-1 text-sm text-slate-400">
            Build workflows that react to WhatsApp® events automatically.
          </p>
        </div>
        <GatedButton
          canAct={canCriar}
          gateReason="create automations"
          onClick={() => router.push("/automations/new")}
          classNome="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus classNome="h-4 w-4" />
          Criar Automation
        </GatedButton>
      </div>

      {showModelos && (
        <section>
          <h2 classNome="mb-3 text-sm font-semibold text-slate-300">Quick-start templates</h2>
          <div classNome="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TEMPLATE_ORDER.map((slug) => {
              const t = AUTOMATION_TEMPLATES[slug]
              const Icon = TEMPLATE_ICON[slug]
              return (
                <button
                  key={slug}
                  onClick={() => startFromModelo(slug)}
                  classNome="group flex flex-col items-start rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-primary/50 hover:bg-slate-900/80"
                >
                  <div classNome="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15">
                    <Icon classNome="h-5 w-5" />
                  </div>
                  <div classNome="text-sm font-semibold text-white">{t.name}</div>
                  <p classNome="mt-1 text-xs text-slate-400">{t.description}</p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {automations.length === 0 ? (
        <div classNome="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <div classNome="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Zap classNome="h-6 w-6 text-primary" />
          </div>
          <p classNome="mt-3 text-sm font-medium text-white">No automations yet</p>
          <p classNome="mt-1 text-xs text-slate-400">
            Pick a template above or create one from scratch.
          </p>
        </div>
      ) : (
        <ul classNome="space-y-3">
          {automations.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={(next) => toggleAtivo(a, next)}
              onEditar={() => router.push(`/automations/${a.id}/edit`)}
              onDuplicar={() => duplicate(a)}
              onLogs={() => router.push(`/automations/${a.id}/logs`)}
              onExcluir={() => setPendingExcluir(a)}
            />
          ))}
        </ul>
      )}

      <Dialog open={!!pendingExcluir} onAbertoChange={(v) => !v && setPendingExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir automation</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span classNome="text-white">{pendingExcluir?.name}</span> and its execution
              history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingExcluir(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmExcluir}
              disabled={deleting}
            >
              {deleting ? <Loader2 classNome="h-4 w-4 animate-spin" /> : <Trash2 classNome="h-4 w-4" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AutomationCard({
  automation,
  onToggle,
  onEditar,
  onDuplicar,
  onLogs,
  onExcluir,
}: {
  automation: Automation
  onToggle: (next: boolean) => void
  onEditar: () => void
  onDuplicar: () => void
  onLogs: () => void
  onExcluir: () => void
}) {
  const meta = triggerMeta(automation.trigger_type)
  return (
    <li classNome="rounded-xl border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700">
      <div classNome="flex items-center gap-4 p-4">
        <div
          classNome="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"
          aria-hidden
        >
          <Zap classNome="h-5 w-5 text-primary" />
        </div>

        <button
          type="button"
          onClick={onEditar}
          classNome="min-w-0 flex-1 text-left"
        >
          <div classNome="flex items-center gap-2">
            <span classNome="truncate text-sm font-semibold text-white">
              {automation.name}
            </span>
            {automation.is_active && (
              <span classNome="relative flex h-2 w-2" aria-label="active">
                <span classNome="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span classNome="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
          </div>
          {automation.description && (
            <p classNome="mt-0.5 truncate text-xs text-slate-400">{automation.description}</p>
          )}
          <div classNome="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span
              classNome={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                meta.pillClass,
              )}
            >
              {meta.label}
            </span>
            <span classNome="tabular-nums">
              {automation.execution_count} run{automation.execution_count === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>last {formatRelative(automation.last_executed_at)}</span>
          </div>
        </button>

        <div classNome="flex items-center gap-3">
          <Switch
            checked={automation.is_active}
            onCheckedChange={(v) => onToggle(!!v)}
            aria-label={automation.is_active ? "Deactivate" : "Activate"}
          />

          <DropdownMenu>
            <DropdownMenuGatilho
              aria-label="Aberto menu"
              classNome="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white data-[popup-open]:bg-slate-800"
            >
              <MoreVertical classNome="h-4 w-4" />
            </DropdownMenuGatilho>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditar}>
                <Pencil classNome="h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicar}>
                <Copiar classNome="h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogs}>
                <FileText classNome="h-4 w-4" />
                View Logs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onExcluir}>
                <Trash2 classNome="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}
