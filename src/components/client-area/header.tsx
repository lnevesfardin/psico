"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarClock, LogOut, Search, Smile, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/agendamentos", label: "Meus Agendamentos", icon: CalendarClock },
  { href: "/agendamentos/humor", label: "Humor", icon: Smile },
  { href: "/agendar", label: "Buscar Psicólogo", icon: Search },
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
    // sticky + translúcido + backdrop-blur: mesmo tratamento "glass" do
    // header da landing page (src/app/page.tsx) — o conteúdo passa por
    // baixo desfocado ao rolar, em vez de um header opaco chapado.
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/70 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
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
          {/* flex-wrap (em vez de deixar os links encolherem): com 4 itens o
              menu não cabe numa linha só em telas estreitas — sem isso o
              texto quebrava dentro do botão ("Meus" numa linha,
              "Agendamentos" na outra). Aqui o item que não coube desce pra
              uma segunda linha inteiro, em vez de cortar o texto. */}
          <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-zinc-200/70 bg-white/60 p-1 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-white/[0.04]">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                      : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white sm:flex"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
