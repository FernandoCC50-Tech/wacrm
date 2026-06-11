"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Menu, Settings as SettingsIcon, User } from "lucide-react";
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

const pageTitles: Record<string, string> = {
  "/dashboard": "Painel",
  "/inbox": "Caixa de Entrada",
  "/contacts": "Contatos",
  "/pipelines": "Funis",
  "/broadcasts": "Transmissões",
  "/automations": "Automações",
  "/settings": "Configurações",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "Painel";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onAbertoSidebar?: () => void;
}

export function Header({ onAbertoSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const title = getPageTitle(pathname);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header classNome="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 lg:px-6">
      <div classNome="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onAbertoSidebar}
          aria-label="Aberto menu"
          classNome="flex h-10 w-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <Menu classNome="h-5 w-5" />
        </button>
        <h1 classNome="truncate text-base font-semibold text-white sm:text-lg">
          {title}
        </h1>
      </div>

      <DropdownMenu>
        <DropdownMenuGatilho
          classNome="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-slate-800/70 focus:bg-slate-800/70 focus:outline-none data-popup-open:bg-slate-800/70 sm:gap-3 sm:pl-1 sm:pr-3"
          aria-label="Aberto account menu"
        >
          <Avatar classNome="size-8">
            {profile?.avatar_url ? (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.full_name ?? "Avatar"}
              />
            ) : null}
            <AvatarFallback classNome="bg-primary/10 text-sm font-medium text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span classNome="hidden text-sm font-medium text-white sm:inline">
            {profile?.full_name ?? "Usuário"}
          </span>
        </DropdownMenuGatilho>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          classNome="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
        >
          <div classNome="px-2 py-1.5">
            <p classNome="truncate text-sm font-medium text-white">
              {profile?.full_name ?? "Usuário"}
            </p>
            <p classNome="truncate text-xs text-slate-400">
              {profile?.email ?? ""}
            </p>
          </div>
          <DropdownMenuSeparator classNome="bg-slate-800" />
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=profile"
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
                classNome="text-slate-200 focus:bg-slate-800 focus:text-white"
              />
            }
          >
            <SettingsIcon classNome="size-4" />
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
    </header>
  );
}
