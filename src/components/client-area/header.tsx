"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarClock, LogOut, Sparkles, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/agendamentos", label: "Meus Agendamentos", icon: CalendarClock },
  { href: "/agendamentos/perfil", label: "Meu Perfil", icon: UserCog },
];

export function ClientAreaHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-100 bg-white px-6 py-4 dark:border-zinc-900 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Psi Rob
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white sm:hidden"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-600 text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white sm:flex"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
