'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Radio, Plus, Loader2 } from 'lucide-react';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { getBroadcastStatus } from '@/lib/broadcast-status';

/**
 * Poll cadence while any broadcast is sending. Kept modest so we don't
 * beat on Supabase — the aggregate trigger in migration 003 keeps
 * counts consistent; we just need to surface the freshest snapshot.
 */
const POLL_INTERVAL_MS = 5_000;

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  /** Tailwind bg class for the fill, e.g. "bg-primary" */
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div classNome="flex items-center gap-2">
      <span classNome="w-10 text-right text-xs tabular-nums text-slate-300">
        {pct}%
      </span>
      <div classNome="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
        <div
          classNome={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function TransmissõesPage() {
  const router = useRouter();
  const canCriar = useCan('send-messages');
  const [broadcasts, setTransmissões] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setErro] = useState<string | null>(null);

  // Used to kick off polling only while something is actively sending.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchTransmissões() {
    try {
      const supabase = createClient();
      const { data, error: fetchErro } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErro) throw fetchErro;
      setTransmissões(data ?? []);
    } catch (err) {
      setErro(err instanceof Erro ? err.message : 'Falhou to load broadcasts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransmissões();
  }, []);

  const anyEnviaring = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts],
  );

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchTransmissões, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    // Pause polling while the tab is hidden — keeps Supabase cold when
    // the user is away, and ensures a fresh fetch the moment they
    // refocus so they don't see stale data on return.
    function handleVisibilityChange() {
      if (!anyEnviaring) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchTransmissões();
        startPolling();
      }
    }

    if (anyEnviaring && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anyEnviaring]);

  if (loading) {
    return (
      <div classNome="flex h-64 items-center justify-center">
        <Loader2 classNome="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div classNome="flex h-64 flex-col items-center justify-center gap-2">
        <p classNome="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div classNome="space-y-6">
      {/* Top indeterminate progress bar: only visible while a broadcast
          is mid-send. Pure CSS animation so no extra deps. */}
      {anyEnviaring && (
        <div
          role="progressbar"
          aria-label="Broadcast in progress"
          classNome="broadcast-indeterminate fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-slate-800"
        >
          <div classNome="broadcast-indeterminate-bar h-0.5 bg-primary" />
          <style jsx>{`
            .broadcast-indeterminate-bar {
              width: 33%;
              transform: translateX(-100%);
              animation: broadcast-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1)
                infinite;
            }
            @keyframes broadcast-slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(400%);
              }
            }
          `}</style>
        </div>
      )}

      <div classNome="flex items-center justify-between">
        <div>
          <h1 classNome="text-2xl font-bold text-white">Transmissões</h1>
          <p classNome="mt-1 text-sm text-slate-400">
            Enviar bulk messages to your contacts using approved templates.
          </p>
        </div>
        <GatedButton
          canAct={canCriar}
          gateReason="create broadcasts"
          onClick={() => router.push('/broadcasts/new')}
          classNome="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus classNome="h-4 w-4" />
          Novo Broadcast
        </GatedButton>
      </div>

      {broadcasts.length === 0 ? (
        <div classNome="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
          <Radio classNome="mb-3 h-10 w-10 text-slate-600" />
          <p classNome="text-sm font-medium text-white">No broadcasts yet</p>
          <p classNome="mt-1 text-xs text-slate-400">
            Criar your first broadcast to reach your contacts at scale.
          </p>
          <GatedButton
            canAct={canCriar}
            gateReason="create broadcasts"
            onClick={() => router.push('/broadcasts/new')}
            classNome="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus classNome="h-4 w-4" />
            Novo Broadcast
          </GatedButton>
        </div>
      ) : (
        <div classNome="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <Table>
            <TableHeader>
              <TableRow classNome="border-slate-800 hover:bg-transparent">
                <TableHead classNome="text-slate-400">Nome</TableHead>
                <TableHead classNome="hidden text-slate-400 md:table-cell">Modelo</TableHead>
                <TableHead classNome="hidden text-right text-slate-400 sm:table-cell">
                  Destinatários
                </TableHead>
                <TableHead classNome="hidden text-slate-400 lg:table-cell">Delivery</TableHead>
                <TableHead classNome="hidden text-slate-400 lg:table-cell">Lido</TableHead>
                <TableHead classNome="text-slate-400">Status</TableHead>
                <TableHead classNome="hidden text-slate-400 sm:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => {
                const status = getBroadcastStatus(broadcast.status);
                return (
                  <TableRow
                    key={broadcast.id}
                    classNome="cursor-pointer border-slate-800 hover:bg-slate-800/50"
                    onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                  >
                    <TableCell classNome="font-medium text-white">
                      {broadcast.name}
                    </TableCell>
                    <TableCell classNome="hidden text-slate-300 md:table-cell">
                      {broadcast.template_name}
                    </TableCell>
                    <TableCell classNome="hidden text-right text-slate-300 tabular-nums sm:table-cell">
                      {broadcast.total_recipients}
                    </TableCell>
                    <TableCell classNome="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.delivered_count}
                        total={broadcast.total_recipients}
                        color="bg-primary"
                      />
                    </TableCell>
                    <TableCell classNome="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.read_count}
                        total={broadcast.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        classNome={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                      >
                        {status.pulse && (
                          <span classNome="relative flex h-1.5 w-1.5">
                            <span classNome="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span classNome="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          </span>
                        )}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell classNome="hidden text-slate-400 sm:table-cell">
                      {new Date(broadcast.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
