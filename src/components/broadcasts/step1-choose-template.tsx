'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageModelo } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ArrowRight } from 'lucide-react';

const categoryCors: Record<string, string> = {
  Marketing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Utility: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Authentication: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

interface Step1Props {
  selectedModelo: MessageModelo | null;
  onSelecionar: (template: MessageModelo) => void;
  onPróximo: () => void;
  onVoltar: () => void;
}

export function Step1ChooseModelo({ selectedModelo, onSelecionar, onPróximo, onVoltar }: Step1Props) {
  const [templates, setModelos] = useState<MessageModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModelos() {
      try {
        const supabase = createClient();
        // Only APPROVED templates can be sent via Meta — anything else
        // would 400 at broadcast time. Hide them rather than letting
        // the user pick a template that will fail.
        const { data, error: fetchErro } = await supabase
          .from('message_templates')
          .select('*')
          .eq('status', 'APPROVED')
          .order('created_at', { ascending: false });

        if (fetchErro) throw fetchErro;
        setModelos(data ?? []);
      } catch (err) {
        setErro(err instanceof Erro ? err.message : 'Falhou to load templates');
      } finally {
        setLoading(false);
      }
    }

    fetchModelos();
  }, []);

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
      </div>
    );
  }

  return (
    <div classNome="space-y-6">
      <div>
        <h2 classNome="text-lg font-semibold text-white">Choose a Modelo</h2>
        <p classNome="mt-1 text-sm text-slate-400">
          Selecionar an approved message template for your broadcast.
        </p>
      </div>

      {templates.length === 0 ? (
        <div classNome="flex h-48 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50">
          <FileText classNome="mb-2 h-8 w-8 text-slate-600" />
          <p classNome="text-sm text-slate-400">No templates available.</p>
          <p classNome="mt-1 text-xs text-slate-500">Criar a template in Settings first.</p>
        </div>
      ) : (
        <div classNome="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isSelecionared = selectedModelo?.id === template.id;
            const catCor = categoryCors[template.category] ?? categoryCors.Utility;

            return (
              <button
                key={template.id}
                onClick={() => onSelecionar(template)}
                classNome={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelecionared
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div classNome="flex items-start justify-between">
                  <h3 classNome="text-sm font-medium text-white">{template.name}</h3>
                  <span
                    classNome={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catCor}`}
                  >
                    {template.category}
                  </span>
                </div>
                <p classNome="line-clamp-3 text-xs text-slate-400">{template.body_text}</p>
                <div classNome="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{template.language ?? 'en_US'}</span>
                  {/* Status is omitted on purpose — every template
                      shown here is already filtered to APPROVED,
                      so the chip carried no information. */}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div classNome="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button variant="outline" onClick={onVoltar} classNome="border-slate-700 text-slate-300">
          Voltar
        </Button>
        <Button
          onClick={onPróximo}
          disabled={!selectedModelo}
          classNome="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Próximo
          <ArrowRight classNome="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
