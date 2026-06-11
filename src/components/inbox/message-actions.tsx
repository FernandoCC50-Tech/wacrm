"use client";

import { useState, type ReactNode } from "react";
import { CornerUpLeft, Copiar, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverGatilho,
} from "@/components/ui/popover";
import type { Message } from "@/types";

// WhatsApp's own quick-reaction bar starts with these six. Picking the same
// set keeps the affordance familiar without pulling in a 300KB emoji library.
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageAçãosProps {
  message: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  children: ReactNode;
}

/**
 * Hover/long-press toolbar wrapper around a `<MessageBubble>`. The bubble
 * itself stays a pure presenter — this component owns the action surface so
 * the bubble's render path is unaffected when the toolbar isn't visible.
 */
export function MessageAçãos({
  message,
  onReply,
  onReact,
  children,
}: MessageAçãosProps) {
  // Touch devices have no hover. Long-press fires `contextmenu`; we capture
  // it, suppress the native menu, and pin the toolbar open until the user
  // interacts elsewhere.
  const [touchAberto, setTouchAberto] = useState(false);
  const [pickerAberto, setPickerAberto] = useState(false);

  const isAgent =
    message.sender_type === "agent" || message.sender_type === "bot";

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setTouchAberto(true);
  };

  const handleCopiar = async () => {
    const text = message.content_text ?? "";
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copiar failed");
    }
    setTouchAberto(false);
  };

  const handlePickEmoji = (emoji: string) => {
    onReact(emoji);
    setPickerAberto(false);
    setTouchAberto(false);
  };

  const handleReply = () => {
    onReply();
    setTouchAberto(false);
  };

  // Row alignment lives here (not in MessageBubble) so the `group/actions`
  // hover region matches the bubble's content width — hovering empty space
  // in the row no longer reveals the toolbar.
  return (
    <div
      classNome={cn(
        "flex w-full",
        isAgent ? "justify-end" : "justify-start",
      )}
      onContextMenu={handleContextMenu}
      onBlur={() => setTouchAberto(false)}
    >
      {/* `min-w-0` lets this flex child actually respect the 75% cap.
       *  Default `min-width: auto` lets content (a long quote preview,
       *  an unbroken URL) push past the cap and shove the row past
       *  100%, which used to bleed across into the contact-sidebar
       *  area. See issue #165. */}
      <div classNome="group/actions relative min-w-0 max-w-[75%]">
        {children}
      <div
        data-touch-open={touchAberto || pickerAberto ? "true" : undefined}
        classNome={cn(
          "absolute -top-3 z-10 flex h-7 items-center gap-0.5 rounded-full border border-slate-700 bg-slate-900/95 px-1 shadow-md backdrop-blur-sm transition-opacity",
          "opacity-0 group-hover/actions:opacity-100 group-focus-within/actions:opacity-100",
          "data-[touch-open=true]:opacity-100",
          isAgent ? "right-3" : "left-3",
        )}
      >
        <Popover open={pickerAberto} onAbertoChange={setPickerAberto}>
          <PopoverGatilho
            classNome="flex h-5 w-5 items-center justify-center rounded-full text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="React"
          >
            <SmilePlus classNome="h-3.5 w-3.5" />
          </PopoverGatilho>
          <PopoverContent
            classNome="flex w-auto flex-row gap-1 p-1.5"
            sideOffset={6}
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handlePickEmoji(e)}
                classNome="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-slate-700"
                aria-label={`React with ${e}`}
              >
                {e}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={handleReply}
          classNome="flex h-5 w-5 items-center justify-center rounded-full text-slate-300 hover:bg-slate-700 hover:text-white"
          aria-label="Reply"
        >
          <CornerUpLeft classNome="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCopiar}
          classNome="flex h-5 w-5 items-center justify-center rounded-full text-slate-300 hover:bg-slate-700 hover:text-white"
          aria-label="Copiar"
        >
          <Copiar classNome="h-3.5 w-3.5" />
        </button>
      </div>
      </div>
    </div>
  );
}
