"use client";

import Link from "next/link";
import { O2Logo } from "@/components/ui/o2-logo";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  Crown,
  GitBranch,
  LayoutPainel,
  LogOut,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountFunção } from "@/lib/auth/roles";

// Per-role chip metadata used in the sidebar's account strip + the
// Membros tab roster. Keeping this near both consumers in a single
// place avoids drift between the two surfaces — when a designer
// wants to recolour "agent" rows, this is the one diff.
const ROLE_CHIP: Record<
  AccountFunção,
  { icon: typeof Crown; label: string; classNome: string }
> = {
  owner: {
    icon: Crown,
    label: "Proprietário",
    // Amber: scarce, immutable, "the boss" — gets visual emphasis.
    classNome:
      "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    label: "Administrador",
    // Principal-tinted: significant but not as scarce as owner.
    classNome:
      "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    label: "Agente",
    // Neutral slate: the operational default.
    classNome:
      "border-slate-700 bg-slate-800 text-slate-300",
  },
  viewer: {
    icon: User,
    label: "Visualizador",
    // Muted slate: read-only role; visually quieter than agent.
    classNome:
      "border-slate-800 bg-slate-900 text-slate-500",
  },
};
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGatilho,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutPainel;
  /**
   * When true, the nav row renders a small "Beta" chip after the label.
   * Purely informational — doesn't affect routing or access.
   */
  beta?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutPainel },
  { href: "/inbox", label: "Caixa de Entrada", icon: MessageSquare },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/pipelines", label: "Funis", icon: GitBranch },
  { href: "/broadcasts", label: "Transmissões", icon: Radio },
  { href: "/automations", label: "Automações", icon: Zap },
  { href: "/flows", label: "Fluxos", icon: Workflow, beta: true },
];

const bottomNavItems = [
  { href: "/settings", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onFechar?: () => void;
}

export function Sidebar({ open = false, onFechar }: SidebarProps) {
  const pathname = usePathname();
  const { profile, profileLoading, account, accountFunção, signOut } = useAuth();
  const totalUnread = useTotalUnread();
  // Only surface the account-name strip when it actually carries
  // information. A solo user's personal account is named after them
  // (the 017 signup trigger seeds it from `full_name`), so showing it
  // here would just duplicate the user name in the footer below. Once
  // the account is renamed or the user joins a shared account, the
  // name diverges and the strip becomes meaningful — that's the signal
  // we gate on. Wait for the profile fetch to settle first, otherwise
  // the strip flashes in once the row resolves (a layout jump).
  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  // Fechar the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onFechar?.();
    // Only pathname drives this — onFechar identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onFechar]);

  return (
    <>
      {/* Voltardrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onFechar}
        classNome={cn(
          "fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        classNome={cn(
          // Mobile: fixed drawer that slides in from the left.
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible — reset all the mobile framing.
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Principal"
      >
        {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
        <div classNome="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4">
          <Link href="/dashboard" classNome="flex items-center gap-2">
            <div classNome="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare classNome="h-4 w-4" />
            </div>
            <span classNome="text-sm font-semibold text-white">
              CRM para WhatsApp
            </span>
          </Link>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar menu"
            classNome="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X classNome="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav classNome="flex-1 overflow-y-auto px-3 py-4">
          <ul classNome="flex flex-col gap-1">
            {navItems.map((item) => {
              const isAtivo =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const showUnreadDot =
                item.href === "/inbox" && totalUnread > 0 && !isAtivo;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    classNome={cn(
                      // Taller on mobile so fingers can hit the row reliably (≥44px).
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isAtivo
                        ? "bg-primary/10 text-primary"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <item.icon classNome="h-4 w-4" />
                    <span classNome="flex-1">{item.label}</span>
                    {item.beta && (
                      <span
                        aria-label="Funcionalidade Beta"
                        classNome="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
                      >
                        Beta
                      </span>
                    )}
                    {showUnreadDot && (
                      <span
                        aria-label={`${totalUnread} conversa não lida${totalUnread === 1 ? "" : "s"}`}
                        classNome="relative flex h-2 w-2"
                      >
                        <span classNome="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span classNome="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div classNome="my-4 border-t border-slate-800" />

          <ul classNome="flex flex-col gap-1">
            {bottomNavItems.map((item) => {
              const isAtivo = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    classNome={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isAtivo
                        ? "bg-primary/10 text-primary"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <item.icon classNome="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div classNome="shrink-0 border-t border-slate-800 p-3">
          {/* Account name display — surfaced only when the account
              name differs from the user's own name (see
              `showAccountStrip`). For a default solo account the two
              match, so we hide it to avoid duplicating the user name
              below; for renamed or shared accounts it tells the user
              which account they're acting in. */}
          {showAccountStrip && account?.name ? (
            <div classNome="mb-2 flex items-center gap-2 px-3 text-xs text-slate-500">
              <UsersRound classNome="size-3.5 shrink-0" />
              {/* `title=` exposes the full name on hover when it
                  gets truncated (long account names + narrow
                  sidebars). Cheap a11y win. */}
              <span classNome="truncate" title={account.name}>
                {account.name}
              </span>
              {accountFunção ? (
                // Always render the chip — owners used to be
                // invisible here, which made them indistinguishable
                // from admins at a glance. Now everyone sees their
                // role (with a colour cue) regardless of tier.
                (() => {
                  const meta = ROLE_CHIP[accountFunção];
                  const Icon = meta.icon;
                  return (
                    <span
                      classNome={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.classNome}`}
                    >
                      <Icon classNome="size-3" />
                      {meta.label}
                    </span>
                  );
                })()
              ) : null}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuGatilho classNome="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none data-popup-open:bg-slate-800/60">
              <Avatar classNome="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback classNome="bg-primary/10 text-sm font-medium text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div classNome="min-w-0 flex-1">
                <p classNome="truncate text-sm font-medium text-white">
                  {profile?.full_name ?? "Usuário"}
                </p>
                <p classNome="truncate text-xs text-slate-400">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuGatilho>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              classNome="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onFechar}
                    classNome="text-slate-200 focus:bg-slate-800 focus:text-white"
                  />
                }
              >
                <User classNome="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onFechar}
                    classNome="text-slate-200 focus:bg-slate-800 focus:text-white"
                  />
                }
              >
                <Settings classNome="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator classNome="bg-slate-800" />
              <DropdownMenuItem
                onClick={signOut}
                classNome="text-slate-200 focus:bg-slate-800 focus:text-white"
              >
                <LogOut classNome="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
