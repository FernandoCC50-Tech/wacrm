"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageModelo } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rótulo } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ChevronRight,
  LayoutModelo,
  Loader2,
} from "lucide-react";
import { extractVariableIndices } from "@/lib/whatsapp/template-validators";

export interface ModeloEnviarValors {
  body: string[];
  headerText?: string;
  buttonParams?: Record<number, string>;
}

interface ModeloPickerProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  onSelecionar: (template: MessageModelo, values: ModeloEnviarValors) => void;
}

function renderBodyPreview(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, raw) => {
    const idx = Number(raw) - 1;
    const value = params[idx];
    return value && value.trim().length > 0 ? value : `{{${raw}}}`;
  });
}

interface UrlButtonSlot {
  index: number;
  text: string;
  url: string;
}

/**
 * Modelos may need values for: body variables, a text-header
 * variable, and per-URL-button suffixes. Collect them all so the
 * send-message path doesn't 400 on missing parameters.
 */
function collectVariableSlots(template: MessageModelo): {
  bodyVars: number[];
  headerVarCount: number;
  urlButtonSlots: UrlButtonSlot[];
} {
  const bodyVars = extractVariableIndices(template.body_text);
  const headerVarCount =
    template.header_type === "text" && template.header_content
      ? extractVariableIndices(template.header_content).length
      : 0;
  const urlButtonSlots: UrlButtonSlot[] = [];
  (template.buttons ?? []).forEach((b, i) => {
    if (b.type === "URL" && extractVariableIndices(b.url).length > 0) {
      urlButtonSlots.push({ index: i, text: b.text, url: b.url });
    }
  });
  return { bodyVars, headerVarCount, urlButtonSlots };
}

export function ModeloPicker({
  open,
  onAbertoChange,
  onSelecionar,
}: ModeloPickerProps) {
  const [templates, setModelos] = useState<MessageModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelecionared] = useState<MessageModelo | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [headerText, setHeaderText] = useState<string>("");
  const [buttonParams, setButtonParams] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setModelos([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Falhou to fetch templates:", error);
        setModelos([]);
      } else {
        setModelos((data as MessageModelo[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  function resetSelecionarion() {
    setSelecionared(null);
    setParams([]);
    setHeaderText("");
    setButtonParams({});
  }

  function handleAbertoChange(next: boolean) {
    if (!next) resetSelecionarion();
    onAbertoChange(next);
  }

  function pickModelo(template: MessageModelo) {
    const slots = collectVariableSlots(template);
    const noInputsNeeded =
      slots.bodyVars.length === 0 &&
      slots.headerVarCount === 0 &&
      slots.urlButtonSlots.length === 0;
    if (noInputsNeeded) {
      onSelecionar(template, { body: [] });
      handleAbertoChange(false);
      return;
    }
    setSelecionared(template);
    setParams(new Array(slots.bodyVars.length).fill(""));
    setHeaderText("");
    setButtonParams({});
  }

  function confirm() {
    if (!selected) return;
    const values: ModeloEnviarValors = { body: params };
    if (headerText.trim()) values.headerText = headerText.trim();
    if (Object.keys(buttonParams).length > 0) {
      values.buttonParams = Object.fromEntries(
        Object.entries(buttonParams).map(([k, v]) => [Number(k), v.trim()]),
      );
    }
    onSelecionar(selected, values);
    handleAbertoChange(false);
  }

  const slots = useMemo(
    () => (selected ? collectVariableSlots(selected) : null),
    [selected],
  );
  const canConfirmar =
    !!selected &&
    !!slots &&
    slots.bodyVars.every((_, i) => (params[i] ?? "").trim().length > 0) &&
    (slots.headerVarCount === 0 || headerText.trim().length > 0) &&
    slots.urlButtonSlots.every(
      (s) => (buttonParams[s.index] ?? "").trim().length > 0,
    );

  return (
    <Dialog open={open} onAbertoChange={handleAbertoChange}>
      <DialogContent classNome="border-slate-700 bg-slate-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle classNome="flex items-center gap-2 text-white">
            <LayoutModelo classNome="h-4 w-4 text-primary" />
            {selected ? selected.name : "Enviar template"}
          </DialogTitle>
          <DialogDescription classNome="text-slate-400">
            {selected
              ? "Fill in the placeholders to render this template. Meta requires every variable to be set."
              : "Pick an approved WhatsApp template to send to this contact."}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div classNome="max-h-[60vh] space-y-2 overflow-y-auto">
            {loading ? (
              <div classNome="flex items-center justify-center py-8">
                <Loader2 classNome="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : templates.length === 0 ? (
              <div classNome="rounded-md border border-slate-800 bg-slate-950/50 p-6 text-center">
                <p classNome="text-sm text-slate-300">No approved templates</p>
                <p classNome="mt-1 text-xs text-slate-500">
                  Approve a template in Meta WhatsApp Manager, then sync it
                  from Settings → Modelos.
                </p>
              </div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickModelo(t)}
                  classNome="w-full rounded-md border border-slate-800 bg-slate-950/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-slate-900"
                >
                  <div classNome="flex items-start gap-2">
                    <div classNome="min-w-0 flex-1">
                      <div classNome="flex flex-wrap items-center gap-2">
                        <p classNome="truncate text-sm font-medium text-white">
                          {t.name}
                        </p>
                        <Badge classNome="border border-primary/30 bg-primary/20 text-[10px] text-primary">
                          {t.category}
                        </Badge>
                        {t.language && (
                          <span classNome="text-[10px] uppercase text-slate-500">
                            {t.language}
                          </span>
                        )}
                      </div>
                      <p classNome="mt-1 line-clamp-2 text-xs text-slate-400">
                        {t.body_text}
                      </p>
                    </div>
                    <ChevronRight classNome="h-4 w-4 flex-shrink-0 text-slate-500" />
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div classNome="space-y-3">
            <div classNome="rounded-md border border-slate-800 bg-slate-950/50 p-3">
              <p classNome="mb-1 text-xs text-slate-400">Preview</p>
              <p classNome="whitespace-pre-wrap text-sm text-slate-200">
                {renderBodyPreview(selected.body_text, params)}
              </p>
              {selected.footer_text && (
                <p classNome="mt-2 text-xs italic text-slate-500">
                  {selected.footer_text}
                </p>
              )}
            </div>
            {slots && slots.headerVarCount > 0 && (
              <div classNome="space-y-1">
                <Rótulo classNome="text-xs text-slate-300">
                  {`Header {{1}}`}
                </Rótulo>
                <Input
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="Valor for the header variable"
                  classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
            )}
            {slots?.bodyVars.map((v, i) => (
              <div key={v} classNome="space-y-1">
                <Rótulo classNome="text-xs text-slate-300">{`Body {{${v}}}`}</Rótulo>
                <Input
                  value={params[i] ?? ""}
                  onChange={(e) => {
                    const next = [...params];
                    next[i] = e.target.value;
                    setParams(next);
                  }}
                  placeholder={`Valor for {{${v}}}`}
                  classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
            ))}
            {slots?.urlButtonSlots.map((slot) => (
              <div key={slot.index} classNome="space-y-1">
                <Rótulo classNome="text-xs text-slate-300">
                  {`URL button "${slot.text}" — value for `}{`{{1}}`}
                </Rótulo>
                <Input
                  value={buttonParams[slot.index] ?? ""}
                  onChange={(e) =>
                    setButtonParams((prev) => ({
                      ...prev,
                      [slot.index]: e.target.value,
                    }))
                  }
                  placeholder="URL suffix value"
                  classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
                <p classNome="text-[10px] text-slate-500 break-all">
                  Final URL: {slot.url.replace(/\{\{1\}\}/g, buttonParams[slot.index] || "{{1}}")}
                </p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter classNome="gap-2">
          {selected ? (
            <>
              <Button
                variant="outline"
                onClick={resetSelecionarion}
                classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft classNome="h-4 w-4" />
                Voltar
              </Button>
              <Button
                disabled={!canConfirmar}
                onClick={confirm}
                classNome="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Enviar template
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => handleAbertoChange(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
