import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CalendarClock, LayoutDashboard, LogIn } from "lucide-react";

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "O endereço acessado não existe ou foi movido.",
  robots: { index: false, follow: true },
};

// Os atalhos cobrem os três tipos de visitante que caem aqui por link velho
// ou token expirado: quem ainda não tem conta, o psicólogo e o paciente.
const atalhos = [
  {
    href: "/",
    icon: ArrowLeft,
    title: "Voltar para a página inicial",
    description: "Conhecer a plataforma e os planos.",
  },
  {
    href: "/login",
    icon: LogIn,
    title: "Entrar na minha conta",
    description: "Acessar com e-mail e senha.",
  },
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Área do psicólogo",
    description: "Agenda, pacientes e prontuários.",
  },
  {
    href: "/agendamentos",
    icon: CalendarClock,
    title: "Meus agendamentos",
    description: "Para quem é paciente e já tem conta.",
  },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-ink-950">
      <div className="w-full max-w-lg">
        <div className="mb-10 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
          Psico
        </div>

        <div className="text-center">
          <p className="text-6xl font-bold tracking-tight text-brand-600 dark:text-brand-400">
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Esta página não existe
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            O endereço pode ter sido digitado errado, ou o link que você recebeu
            já expirou. Se era um convite do seu psicólogo, peça um novo link
            para ele.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {atalhos.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-500/50"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs font-normal leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
