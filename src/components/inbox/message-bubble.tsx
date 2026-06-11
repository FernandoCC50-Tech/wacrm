"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction } from "@/types";
import {
  Clock,
  Check,
  CheckCheck,
  XCircle,
  FileText,
  MapPin,
  LayoutModelo,
  ImageOff,
  CornerDownLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ReplyQuote } from "./reply-quote";
import { MessageReactions } from "./message-reactions";

interface MessageBubbleProps {
  message: Message;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorRótulo: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "sending":
      return <Clock classNome="h-3 w-3 text-slate-400" />;
    case "sent":
      return <Check classNome="h-3 w-3 text-slate-400" />;
    case "delivered":
      return <CheckCheck classNome="h-3 w-3 text-slate-400" />;
    case "read":
      return <CheckCheck classNome="h-3 w-3 text-blue-400" />;
    case "failed":
      return <XCircle classNome="h-3 w-3 text-red-400" />;
    default:
      return null;
  }
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div classNome="flex items-center gap-2 rounded-lg bg-slate-700/40 px-3 py-2 text-xs text-slate-300">
      <ImageOff classNome="h-4 w-4 shrink-0 text-slate-500" />
      <span>{label} unavailable</span>
    </div>
  );
}

function MediaImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setErro] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadImage = useCallback(async () => {
    if (!url) return;

    // Proxy URLs need auth fetch to create blob URL
    if (url.startsWith("/api/whatsapp/media/")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Erro("Falhou to load media");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSrc(url);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadImage();
    return () => {
      if (src?.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImage]);

  if (error) {
    return (
      <div classNome="flex h-40 w-60 items-center justify-center rounded-lg bg-slate-700">
        <ImageOff classNome="h-8 w-8 text-slate-500" />
      </div>
    );
  }

  if (loading) {
    return (
      <div classNome="flex h-40 w-60 items-center justify-center rounded-lg bg-slate-700">
        <div classNome="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <img
      src={src ?? ""}
      alt={alt}
      classNome="max-h-64 max-w-60 rounded-lg object-cover"
      onErro={() => setErro(true)}
    />
  );
}

function MessageContent({ message }: { message: Message }) {
  switch (message.content_type) {
    case "text":
      return (
        <p classNome="whitespace-pre-wrap break-words text-sm">
          {message.content_text}
        </p>
      );

    case "image":
      return (
        <div>
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label="Image" />
          )}
          {message.content_text && (
            <p classNome="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "video":
      return (
        <div>
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              classNome="max-h-64 max-w-60 rounded-lg"
            />
          ) : (
            <MediaUnavailable label="Video" />
          )}
          {message.content_text && (
            <p classNome="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <audio src={message.media_url} controls classNome="max-w-60" />
          ) : (
            <MediaUnavailable label="Audio" />
          )}
        </div>
      );

    case "document":
      if (!message.media_url) {
        return <MediaUnavailable label={message.content_text || "Document"} />;
      }
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          classNome="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2 text-sm hover:bg-slate-700"
        >
          <FileText classNome="h-5 w-5 shrink-0 text-slate-400" />
          <span classNome="truncate">
            {message.content_text || "Document"}
          </span>
        </a>
      );

    case "template":
      return (
        <div>
          <span classNome="mb-1 inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <LayoutModelo classNome="h-3 w-3" />
            Modelo
          </span>
          {message.content_text && (
            <p classNome="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "location":
      return (
        <div classNome="flex items-center gap-2 text-sm">
          <MapPin classNome="h-4 w-4 shrink-0 text-slate-400" />
          <span>{message.content_text || "Location shared"}</span>
        </div>
      );

    case "interactive": {
      // Customer tapped a reply button or list row on a message the bot
      // sent. We show the tapped option's title (already in content_text,
      // set by parseMessageContent in the webhook) with a small affordance
      // so agents reading the inbox can tell at a glance that this is a
      // tap rather than the customer typing the same words.
      return (
        <div classNome="flex flex-col gap-0.5">
          <span classNome="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            <CornerDownLeft classNome="h-3 w-3" />
            Button reply
          </span>
          <p classNome="whitespace-pre-wrap break-words text-sm">
            {message.content_text || "[Interactive reply]"}
          </p>
        </div>
      );
    }

    default:
      return (
        <p classNome="whitespace-pre-wrap break-words text-sm">
          {message.content_text || "[Unsupported message type]"}
        </p>
      );
  }
}

export function MessageBubble({
  message,
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
}: MessageBubbleProps) {
  const isAgent = message.sender_type === "agent" || message.sender_type === "bot";
  const time = format(new Date(message.created_at), "HH:mm");

  // Row alignment + width cap are owned by <MessageAçãos> so its hover
  // group matches the bubble's content area, not the full row.
  return (
    <div
      classNome={cn(
        "flex flex-col",
        isAgent ? "items-end" : "items-start",
      )}
    >
      <div
        classNome={cn(
          "relative rounded-2xl px-3 py-2",
          isAgent
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-slate-800 text-slate-100",
        )}
      >
        {reply && (
          <ReplyQuote authorRótulo={reply.authorRótulo} preview={reply.preview} />
        )}
        <MessageContent message={message} />
        <div
          classNome={cn(
            "mt-1 flex items-center gap-1",
            isAgent ? "justify-end" : "justify-start",
          )}
        >
          <span classNome="text-[10px] text-white/60">{time}</span>
          {isAgent && <StatusIcon status={message.status} />}
        </div>
      </div>
      {reactions && reactions.length > 0 && onToggleReaction && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      )}
    </div>
  );
}
