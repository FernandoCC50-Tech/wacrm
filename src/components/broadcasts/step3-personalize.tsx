'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, CustomField, MessageModelo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Selecionar,
  SelecionarContent,
  SelecionarItem,
  SelecionarGatilho,
  SelecionarValor,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Eye, Loader2 } from 'lucide-react';

type VariableType = 'static' | 'field' | 'custom_field';

interface VariableMapping {
  type: VariableType;
  value: string;
}

interface Step3Props {
  template: MessageModelo;
  variables: Record<string, VariableMapping>;
  onUpdate: (variables: Record<string, VariableMapping>) => void;
  onPróximo: () => void;
  onVoltar: () => void;
}

const contactFields = [
  { value: 'name', label: 'Contact Nome' },
  { value: 'phone', label: 'Telefone Number' },
  { value: 'email', label: 'E-mail Adicionarress' },
  { value: 'company', label: 'Company' },
];

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  user_id: '',
  account_id: '',
  name: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  company: 'Acme Corp',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function Step3Personalize({
  template,
  variables,
  onUpdate,
  onPróximo,
  onVoltar,
}: Step3Props) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [firstContact, setFirstContact] = useState<Contact | null>(null);
  const [firstContactCustomValors, setFirstContactCustomValors] = useState<
    Map<string, string>
  >(new Map());
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Load user's custom fields + a representative contact for the
  // live preview. Fall back to sample data if no contacts exist yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [fieldsRes, contactRes] = await Promise.all([
        supabase.from('custom_fields').select('*').order('field_name'),
        supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      setCustomFields(fieldsRes.data ?? []);
      setLoadingFields(false);

      const contact = contactRes.data ?? null;
      setFirstContact(contact);

      if (contact) {
        const { data: customVals } = await supabase
          .from('contact_custom_values')
          .select('custom_field_id, value')
          .eq('contact_id', contact.id);
        if (!cancelled) {
          const map = new Map<string, string>();
          for (const row of customVals ?? []) {
            map.set(row.custom_field_id, row.value ?? '');
          }
          setFirstContactCustomValors(map);
        }
      }
      setLoadingPreview(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const placeholders = useMemo(() => {
    const matches = template.body_text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].sort();
  }, [template.body_text]);

  /**
   * A placeholder is "unmapped" if the user hasn't picked either a
   * static value or a field/custom-field source. Blocks Próximo until
   * every placeholder has something — otherwise the broadcast would
   * ship with empty strings and confuse recipients.
   */
  const unmappedKeys = useMemo(() => {
    const missing: string[] = [];
    for (const placeholder of placeholders) {
      const key = placeholder.replace(/^\{\{|\}\}$/g, '');
      const mapping = variables[key];
      if (!mapping || !mapping.value?.trim()) {
        missing.push(placeholder);
      }
    }
    return missing;
  }, [placeholders, variables]);

  function updateVariable(key: string, patch: Partial<VariableMapping>) {
    const current = variables[key] ?? { type: 'static' as VariableType, value: '' };
    onUpdate({
      ...variables,
      [key]: { ...current, ...patch },
    });
  }

  /**
   * Substitute placeholders using the first real contact where
   * possible. Placeholders keyed by "{{N}}" map to variable key "N".
   */
  const previewText = useMemo(() => {
    const contact = firstContact ?? SAMPLE_CONTACT;
    const customValors = firstContact
      ? firstContactCustomValors
      : new Map<string, string>();

    let text = template.body_text;
    for (const placeholder of placeholders) {
      const key = placeholder.replace(/^\{\{|\}\}$/g, '');
      const mapping = variables[key];
      let replacement = placeholder;

      if (mapping) {
        if (mapping.type === 'static' && mapping.value) {
          replacement = mapping.value;
        } else if (mapping.type === 'field' && mapping.value) {
          const fieldMap: Record<string, string | undefined> = {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            company: contact.company,
          };
          replacement = fieldMap[mapping.value] ?? placeholder;
        } else if (mapping.type === 'custom_field' && mapping.value) {
          replacement = customValors.get(mapping.value) || placeholder;
        }
      }
      text = text.replaceTodos(placeholder, replacement);
    }
    return text;
  }, [
    template.body_text,
    variables,
    placeholders,
    firstContact,
    firstContactCustomValors,
  ]);

  const previewRótulo = firstContact
    ? firstContact.name || firstContact.phone
    : 'sample data';

  return (
    <div classNome="space-y-6">
      <div>
        <h2 classNome="text-lg font-semibold text-white">Personalize Message</h2>
        <p classNome="mt-1 text-sm text-slate-400">
          Map template variables to contact fields, custom fields, or static
          values.
        </p>
      </div>

      {placeholders.length === 0 ? (
        <div classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p classNome="text-sm text-slate-400">
            This template has no variables to personalize.
          </p>
        </div>
      ) : (
        <div classNome="space-y-4">
          {placeholders.map((placeholder) => {
            const key = placeholder.replace(/^\{\{|\}\}$/g, '');
            const mapping = variables[key] ?? { type: 'static', value: '' };

            return (
              <div
                key={placeholder}
                classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <div classNome="mb-3 flex items-center gap-2">
                  <span classNome="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium text-primary">
                    {placeholder}
                  </span>
                </div>

                <div classNome="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label classNome="mb-1.5 block text-xs font-medium text-slate-400">
                      Mapping Type
                    </label>
                    <Selecionar
                      value={mapping.type}
                      onValorChange={(val) =>
                        updateVariable(key, {
                          type: val as VariableType,
                          value: '',
                        })
                      }
                    >
                      <SelecionarGatilho classNome="w-full border-slate-700 bg-slate-800 text-white">
                        <SelecionarValor />
                      </SelecionarGatilho>
                      <SelecionarContent classNome="border-slate-700 bg-slate-800">
                        <SelecionarItem value="static">Static Valor</SelecionarItem>
                        <SelecionarItem value="field">Contact Field</SelecionarItem>
                        <SelecionarItem value="custom_field">
                          Custom Field
                        </SelecionarItem>
                      </SelecionarContent>
                    </Selecionar>
                  </div>

                  <div>
                    <label classNome="mb-1.5 block text-xs font-medium text-slate-400">
                      {mapping.type === 'static' ? 'Valor' : 'Field'}
                    </label>
                    {mapping.type === 'static' ? (
                      <Input
                        value={mapping.value}
                        onChange={(e) =>
                          updateVariable(key, { value: e.target.value })
                        }
                        placeholder="Enter value..."
                        classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                      />
                    ) : mapping.type === 'field' ? (
                      <Selecionar
                        value={mapping.value || undefined}
                        onValorChange={(val) =>
                          updateVariable(key, { value: val || '' })
                        }
                      >
                        <SelecionarGatilho classNome="w-full border-slate-700 bg-slate-800 text-white">
                          <SelecionarValor placeholder="Selecionar field..." />
                        </SelecionarGatilho>
                        <SelecionarContent classNome="border-slate-700 bg-slate-800">
                          {contactFields.map((field) => (
                            <SelecionarItem key={field.value} value={field.value}>
                              {field.label}
                            </SelecionarItem>
                          ))}
                        </SelecionarContent>
                      </Selecionar>
                    ) : (
                      <Selecionar
                        value={mapping.value || undefined}
                        onValorChange={(val) =>
                          updateVariable(key, { value: val || '' })
                        }
                      >
                        <SelecionarGatilho classNome="w-full border-slate-700 bg-slate-800 text-white">
                          <SelecionarValor
                            placeholder={
                              loadingFields
                                ? 'Loading…'
                                : customFields.length === 0
                                  ? 'No custom fields'
                                  : 'Selecionar custom field…'
                            }
                          />
                        </SelecionarGatilho>
                        <SelecionarContent classNome="border-slate-700 bg-slate-800">
                          {customFields.map((f) => (
                            <SelecionarItem key={f.id} value={f.id}>
                              {f.field_name}
                            </SelecionarItem>
                          ))}
                        </SelecionarContent>
                      </Selecionar>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Preview — rendered as a WhatsApp-style bubble so the user
          sees approximately what the recipient will see. */}
      <div classNome="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div classNome="mb-3 flex items-center gap-2">
          <Eye classNome="h-4 w-4 text-primary" />
          <p classNome="text-sm font-medium text-white">Live Preview</p>
          <span classNome="text-xs text-slate-500">({previewRótulo})</span>
          {loadingPreview && (
            <Loader2 classNome="h-3.5 w-3.5 animate-spin text-primary" />
          )}
        </div>
        <div classNome="rounded-lg bg-[#0e1a12] p-3">
          <div classNome="ml-auto max-w-[85%] rounded-lg bg-primary/30 px-3 py-2 shadow-sm">
            <p classNome="whitespace-pre-wrap text-sm text-primary">
              {previewText}
            </p>
          </div>
        </div>
      </div>

      {unmappedKeys.length > 0 && (
        <div classNome="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Map every placeholder before continuing — still missing{' '}
          <span classNome="font-mono font-semibold">
            {unmappedKeys.join(', ')}
          </span>
          . Otherwise those placeholders will ship to Meta as empty strings.
        </div>
      )}

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
          disabled={unmappedKeys.length > 0}
          classNome="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Próximo
          <ArrowRight classNome="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
