'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageModelo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogGatilho,
} from '@/components/ui/dialog';
import { ArrowLeft, Enviar, Loader2, Users, Salvar } from 'lucide-react';

interface AudienceConfig {
  type: string;
  tagIds?: string[];
  csvContatos?: { phone: string; name?: string }[];
}

interface Step4Props {
  name: string;
  onNomeChange: (name: string) => void;
  template: MessageModelo;
  audience: AudienceConfig;
  onEnviar: () => void;
  onSalvarRascunho?: () => void;
  onVoltar: () => void;
  isProcessing: boolean;
  progress: number;
}

export function Step4ScheduleEnviar({
  name,
  onNomeChange,
  template,
  audience,
  onEnviar,
  onSalvarRascunho,
  onVoltar,
  isProcessing,
  progress,
}: Step4Props) {
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
          setEstimatedReach(count ?? 0);
        } else if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
          const { data: contactEtiquetas } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);

          const uniqueIds = new Set((contactEtiquetas ?? []).map((ct) => ct.contact_id));
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContatos) {
          setEstimatedReach(audience.csvContatos.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }

    calculateReach();
  }, [audience]);

  const audienceRótulo =
    audience.type === 'all'
      ? 'Todos Contatos'
      : audience.type === 'tags'
        ? `Etiquetas (${audience.tagIds?.length ?? 0} selected)`
        : audience.type === 'csv'
          ? 'CSV Enviar'
          : 'Custom';

  return (
    <div classNome="space-y-6">
      <div>
        <h2 classNome="text-lg font-semibold text-white">Review & Enviar</h2>
        <p classNome="mt-1 text-sm text-slate-400">
          Nome your broadcast, review the details, and send.
        </p>
      </div>

      {/* Broadcast Nome */}
      <div>
        <label classNome="mb-1.5 block text-sm font-medium text-white">Broadcast Nome</label>
        <Input
          value={name}
          onChange={(e) => onNomeChange(e.target.value)}
          placeholder="e.g. Summer Sale Announcement"
          classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Summary Card */}
      <div classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p classNome="text-sm font-medium text-white">Summary</p>
        <div classNome="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p classNome="text-xs text-slate-400">Modelo</p>
            <p classNome="text-white">{template.name}</p>
          </div>
          <div>
            <p classNome="text-xs text-slate-400">Audience</p>
            <p classNome="text-white">{audienceRótulo}</p>
          </div>
          <div>
            <p classNome="text-xs text-slate-400">Estimated Reach</p>
            <div classNome="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 classNome="h-3 w-3 animate-spin text-primary" />
              ) : (
                <>
                  <Users classNome="h-3.5 w-3.5 text-primary" />
                  <p classNome="font-medium text-white">{estimatedReach.toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p classNome="text-xs text-slate-400">Language</p>
            <p classNome="text-white">{template.language ?? 'en_US'}</p>
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div classNome="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div classNome="mb-2 flex items-center justify-between">
            <div classNome="flex items-center gap-2">
              <Loader2 classNome="h-4 w-4 animate-spin text-primary" />
              <p classNome="text-sm font-medium text-white">Enviaring broadcast...</p>
            </div>
            <span classNome="text-xs font-medium text-primary">{progress}%</span>
          </div>
          <div classNome="h-1.5 w-full rounded-full bg-slate-800">
            <div
              classNome="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div classNome="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onVoltar}
          disabled={isProcessing}
          classNome="border-slate-700 text-slate-300"
        >
          <ArrowLeft classNome="h-4 w-4" />
          Voltar
        </Button>

        <div classNome="flex items-center gap-2">
          {onSalvarRascunho && (
            <Button
              variant="outline"
              onClick={onSalvarRascunho}
              disabled={!name.trim() || isProcessing}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <Salvar classNome="h-4 w-4" />
              Salvar as Rascunho
            </Button>
          )}

          <Dialog open={showConfirmar} onAbertoChange={setShowConfirmar}>
          <DialogGatilho
            render={
              <Button
                disabled={!name.trim() || isProcessing}
                classNome="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              />
            }
          >
            <Enviar classNome="h-4 w-4" />
            Enviar Broadcast
          </DialogGatilho>
          <DialogContent classNome="border-slate-700 bg-slate-900 sm:max-w-md">
            <DialogHeader>
              <DialogTitle classNome="text-white">Confirmar Broadcast</DialogTitle>
              <DialogDescription classNome="text-slate-400">
                You are about to send this broadcast to{' '}
                <span classNome="font-medium text-white">{estimatedReach.toLocaleString()}</span>{' '}
                contacts using the{' '}
                <span classNome="font-medium text-white">{template.name}</span> template.
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirmar(false)}
                classNome="border-slate-700 text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setShowConfirmar(false);
                  onEnviar();
                }}
                classNome="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Enviar classNome="h-4 w-4" />
                Confirmar & Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
