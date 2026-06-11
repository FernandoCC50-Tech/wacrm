"use client";

import { Check } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Aparência panel — color-theme picker.
 *
 * Click a card → applies + persists immediately. No save button:
 * the whole change is a single CSS-variable swap on <html>, there's
 * nothing to roll back. The active card carries a check chip + a
 * primary-tinted border so the current pick is obvious.
 *
 * Persistence: localStorage only (device-scoped). The boot script in
 * layout.tsx replays the choice before first paint on subsequent
 * loads.
 */
export function AparênciaPanel() {
  const { theme, setTheme } = useTheme();
  return (
    <section classNome="space-y-4">
      <div>
        <h2 classNome="text-lg font-semibold text-white">Cor theme</h2>
        <p classNome="mt-1 text-sm text-slate-400">
          Pick the accent color used across the app. Todos themes stay
          dark — only the primary color (buttons, active nav, badges)
          changes. Salvard to this device.
        </p>
      </div>

      <div classNome="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            id={t.id}
            name={t.name}
            tagline={t.tagline}
            swatch={t.swatch}
            isAtivo={t.id === theme}
            onPick={() => setTheme(t.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({
  id,
  name,
  tagline,
  swatch,
  isAtivo,
  onPick,
}: {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: string;
  isAtivo: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isAtivo}
      aria-label={`Use ${name} theme`}
      classNome={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
        isAtivo
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/40",
      )}
    >
      <div classNome="flex items-center justify-between">
        <span
          aria-hidden
          classNome="h-8 w-8 shrink-0 rounded-full"
          style={{
            background: swatch,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.15)",
          }}
        />
        {isAtivo && (
          <span classNome="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Check classNome="h-3 w-3" />
            Ativo
          </span>
        )}
      </div>
      <div>
        <div classNome="text-sm font-semibold text-white">{name}</div>
        <div classNome="mt-1 text-xs leading-relaxed text-slate-400">
          {tagline}
        </div>
      </div>
      <div
        classNome="mt-1 flex h-2 overflow-hidden rounded-full"
        aria-hidden
      >
        <span classNome="flex-1" style={{ background: swatch }} />
        <span classNome="w-3 bg-slate-700" />
        <span classNome="w-3 bg-slate-800" />
        <span classNome="w-3 bg-slate-900" />
      </div>
      <span classNome="sr-only">Theme id: {id}</span>
    </button>
  );
}
