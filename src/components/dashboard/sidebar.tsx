"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  Users,
  Wallet,
  Link2,
  Menu,
  X,
  LogOut,
  UserCog,
  FileSignature,
  Sparkles,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/dashboard/notification-bell";

const navItems = [
  { href: "/dashboard/agenda", label: "Agenda de Hoje", icon: CalendarDays },
  { href: "/dashboard/pacientes", label: "Pacientes & Prontuários", icon: Users },
  { href: "/dashboard/documentos", label: "Modelos de Documentos", icon: FileSignature },
  { href: "/dashboard/espaco-interativo", label: "Espaço Interativo", icon: Sparkles },
  { href: "/dashboard/financeiro", label: "Financeiro / Recibos", icon: Wallet },
  { href: "/dashboard/link", label: "Meu Link de Agendamento", icon: Link2 },
  { href: "/dashboard/perfil", label: "Meu Perfil", icon: UserCog },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
          Psico
        </div>
        <NotificationBell />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      {/* pb extra no desktop: dá espaço pro toggle de tema flutuante (fixo no
          canto inferior esquerdo da viewport) não cobrir o botão Sair. */}
      <div className="border-t border-zinc-100 px-6 py-4 md:pb-16 dark:border-zinc-900">
        <Link
          href="/dashboard/perfil"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="h-full w-full object-cover"
              />
            ) : (
              profile.name
                .split(" ")
                .filter((w) => !["Dr.", "Dra."].includes(w))
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
              {profile.name}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">
              {profile.crp}
            </p>
          </div>
        </Link>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeItem = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3 md:hidden dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
          {activeItem?.label ?? "Psico"}
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar: sticky pra continuar visível ao rolar o conteúdo
          principal — sem isso ela rolava junto e sumia de tela em páginas
          longas (ex.: ficha de paciente com várias abas). */}
      <aside className="hidden w-72 shrink-0 self-start border-r border-zinc-100 bg-white md:sticky md:top-0 md:flex md:h-screen dark:border-zinc-900 dark:bg-zinc-950">
        <SidebarContent />
      </aside>
    </>
  );
}
