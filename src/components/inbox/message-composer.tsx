"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Enviar, LayoutModelo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";

interface ReplyRascunho {
  /** Internal UUID of the message being replied to — sent back through onEnviar. */
  id: string;
  authorRótulo: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onEnviar: (text: string, replyToId?: string) => void;
  onAbertoModelos: () => void;
  replyTo?: ReplyRascunho | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onEnviar,
  onAbertoModelos,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setEnviaring] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Viewers (read-only role) can browse the inbox but never send.
  // For solo users this is always true — single-owner accounts pass
  // every capability — so the disabled branch is a no-op there.
  const canEnviar = useCan("send-messages");
  const readOnly = !canEnviar;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleEnviar = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setEnviaring(true);
    try {
      onEnviar(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setEnviaring(false);
    }
  }, [text, sending, sessionExpired, onEnviar, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEnviar();
      }
    },
    [handleEnviar]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  return (
    <div classNome="border-t border-slate-800 bg-slate-900 p-3">
      {replyTo && (
        <div classNome="mb-2">
          <ReplyQuote
            authorRótulo={replyTo.authorRótulo}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}
      {sessionExpired && (
        <div classNome="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p classNome="text-xs text-amber-400">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            classNome="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onAbertoModelos}
          >
            <LayoutModelo classNome="mr-1 h-3 w-3" />
            Modelos
          </Button>
        </div>
      )}

      <div classNome="flex items-end gap-2">
        <GatedButton
          variant="ghost"
          size="sm"
          canAct={!readOnly}
          gateReason="send messages"
          title={readOnly ? undefined : "Enviar template"}
          classNome="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-white"
          onClick={onAbertoModelos}
        >
          <LayoutModelo classNome="h-4 w-4" />
        </GatedButton>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            readOnly
              ? "Lido-only — viewers can browse but not reply"
              : sessionExpired
                ? "Session expired - use a template"
                : "Digite uma mensagem... (Shift+Enter for new line)"
          }
          disabled={sessionExpired || readOnly}
          rows={1}
          // Textarea keeps its own inline title — the GatedButton
          // wrapping pattern doesn't apply to non-button inputs.
          // The placeholder text also surfaces the read-only state.
          title={readOnly ? "Lido-only — your role can't send messages" : undefined}
          classNome={cn(
            "flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-primary/50",
            (sessionExpired || readOnly) && "cursor-not-allowed opacity-50"
          )}
        />

        <GatedButton
          size="sm"
          canAct={!readOnly}
          gateReason="send messages"
          disabled={!text.trim() || sessionExpired || sending}
          onClick={handleEnviar}
          classNome="h-9 w-9 shrink-0 bg-primary p-0 hover:bg-primary/90 disabled:opacity-40"
        >
          <Enviar classNome="h-4 w-4" />
        </GatedButton>
      </div>

      {/* Hint sits outside the flex row so its height doesn't push
          `items-end` buttons below the textarea. Indented to line up
          under the textarea left edge (w-9 button + gap-2 = 44px). */}
      <p classNome="mt-1 pl-11 text-[10px] text-slate-600">
        Type &apos;/&apos; for quick replies
      </p>
    </div>
  );
}
