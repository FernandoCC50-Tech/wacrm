'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Users,
  Etiquetas,
  Filtrar,
  Enviar,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';

type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv';
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFiltrar {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFiltrar;
  csvContatos?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onPróximo: () => void;
  onVoltar: () => void;
}

const audienceOptions: {
  type: AudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    type: 'all',
    label: 'Todos Contatos',
    description: 'Enviar to every contact in your database',
    icon: Users,
  },
  {
    type: 'tags',
    label: 'Filtrar by Etiquetas',
    description: 'Target contacts with specific tags',
    icon: Etiquetas,
  },
  {
    type: 'custom_field',
    label: 'Custom Field',
    description: 'Filtrar by a custom field value',
    icon: Filtrar,
  },
  {
    type: 'csv',
    label: 'Enviar CSV',
    description: 'Enviar a list of phone numbers',
    icon: Enviar,
  },
];

const OPERATOR_OPTIONS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
];

export function Step2SelecionarAudience({
  audience,
  onUpdate,
  onPróximo,
  onVoltar,
}: Step2Props) {
  const [tags, setEtiquetas] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Etiquetas are used both by the primary "Filtrar by Etiquetas" audience type
  // AND by the exclude-list below — so always load once on mount.
  useEffect(() => {
    async function fetchEtiquetas() {
      setLoadingEtiquetas(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setEtiquetas(data ?? []);
      } finally {
        setLoadingEtiquetas(false);
      }
    }
    fetchEtiquetas();
  }, []);

  // Lazy-load custom fields only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'custom_field') return;
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, [audience.type]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const supabase = createClient();

      // Base query — produces the superset before exclude is applied.
      let baseIds: Set<string> | null = null; // null means "all contacts"

      if (audience.type === 'all') {
        // Handled below — full-table count adjusted by excludes.
      } else if (
        audience.type === 'tags' &&
        audience.tagIds &&
        audience.tagIds.length > 0
      ) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.tagIds);
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;
        let q = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);
        if (operator === 'is') q = q.eq('value', value);
        else if (operator === 'is_not') q = q.neq('value', value);
        else q = q.ilike('value', `%${value}%`);
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'csv' &&
        audience.csvContatos &&
        audience.csvContatos.length > 0
      ) {
        setEstimatedCount(audience.csvContatos.length);
        return;
      } else {
        // Partially-configured audience — wait for the user to finish.
        setEstimatedCount(null);
        return;
      }

      // Apply exclude tags
      let excludeSet: Set<string> | null = null;
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);
        excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
      }

      if (baseIds) {
        const effective = [...baseIds].filter(
          (id) => !excludeSet?.has(id),
        );
        setEstimatedCount(effective.length);
      } else {
        // "Todos" — fetch the total, then subtract exclude set if any.
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });
        const total = count ?? 0;
        setEstimatedCount(excludeSet ? Math.max(0, total - excludeSet.size) : total);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.csvContatos,
    audience.excludeTagIds,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFiltrar>) {
    const prev = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    (audience.type === 'csv' &&
      audience.csvContatos &&
      audience.csvContatos.length > 0);

  return (
    <div classNome="space-y-6">
      <div>
        <h2 classNome="text-lg font-semibold text-white">Selecionar Audience</h2>
        <p classNome="mt-1 text-sm text-slate-400">
          Choose who will receive this broadcast.
        </p>
      </div>

      <div classNome="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {audienceOptions.map((option) => {
          const isSelecionared = audience.type === option.type;
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              onClick={() =>
                onUpdate({
                  ...audience,
                  type: option.type,
                  // Wipe shape fields from other types to avoid stale
                  // config leaking across selections.
                  tagIds: option.type === 'tags' ? audience.tagIds : undefined,
                  customField:
                    option.type === 'custom_field'
                      ? audience.customField
                      : undefined,
                  csvContatos:
                    option.type === 'csv' ? audience.csvContatos : undefined,
                })
              }
              classNome={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelecionared
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div
                classNome={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelecionared
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon classNome="h-4 w-4" />
              </div>
              <div>
                <p classNome="text-sm font-medium text-white">{option.label}</p>
                <p classNome="mt-0.5 text-xs text-slate-400">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {audience.type === 'tags' && (
        <div classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p classNome="mb-3 text-sm font-medium text-white">Selecionar Etiquetas</p>
          {loadingEtiquetas ? (
            <Loader2 classNome="h-5 w-5 animate-spin text-primary" />
          ) : tags.length === 0 ? (
            <p classNome="text-xs text-slate-400">
              Nenhuma etiqueta found. Criar etiquetas in Settings.
            </p>
          ) : (
            <div classNome="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelecionared = audience.tagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    classNome={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelecionared
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span
                      classNome="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundCor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div classNome="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p classNome="text-sm font-medium text-white">Custom Field Filtrar</p>
          {loadingFields ? (
            <Loader2 classNome="h-5 w-5 animate-spin text-primary" />
          ) : customFields.length === 0 ? (
            <p classNome="text-xs text-slate-400">
              No custom fields defined. Criar one in Settings → Custom Fields.
            </p>
          ) : (
            <div classNome="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <select
                value={audience.customField?.fieldId ?? ''}
                onChange={(e) => updateCustomField({ fieldId: e.target.value })}
                classNome="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecionar field…</option>
                {customFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name}
                  </option>
                ))}
              </select>
              <select
                value={audience.customField?.operator ?? 'is'}
                onChange={(e) =>
                  updateCustomField({
                    operator: e.target.value as CustomFieldOperator,
                  })
                }
                classNome="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(e) => updateCustomField({ value: e.target.value })}
                placeholder="Valor"
                classNome="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {/* Exclude list — applies regardless of audience type */}
      <div classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div classNome="mb-3 flex items-center gap-2">
          <X classNome="h-4 w-4 text-red-400" />
          <p classNome="text-sm font-medium text-white">
            Exclude contacts with these tags
          </p>
          <span classNome="text-xs text-slate-500">(optional)</span>
        </div>
        {tags.length === 0 ? (
          <p classNome="text-xs text-slate-500">Nenhuma etiqueta available.</p>
        ) : (
          <div classNome="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleExcludeTag(tag.id)}
                  classNome={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    classNome="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundCor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p classNome="mb-2 text-sm font-medium text-white">Audience Summary</p>
        {loadingCount ? (
          <div classNome="flex items-center gap-2">
            <Loader2 classNome="h-4 w-4 animate-spin text-primary" />
            <span classNome="text-xs text-slate-400">Calculating…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div classNome="flex items-center gap-2">
            <Users classNome="h-4 w-4 text-primary" />
            <span classNome="text-sm text-white">
              {estimatedCount.toLocaleString()}
            </span>
            <span classNome="text-xs text-slate-400">estimated recipients</span>
          </div>
        ) : (
          <p classNome="text-xs text-slate-500">
            Selecionar an audience type to see the estimate.
          </p>
        )}
      </div>

      <div classNome="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onVoltar}
          classNome="border-slate-700 text-slate-300"
        >
          <ArrowLeft classNome="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onPróximo}
          disabled={!isValid}
          classNome="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Próximo
          <ArrowRight classNome="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
