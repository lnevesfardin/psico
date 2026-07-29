import Link from "next/link";
import {
  CalendarClock,
  FileText,
  Users,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Prontuário Eletrônico",
    description:
      "Registre evoluções, anotações e históricos de sessões em um prontuário seguro, organizado e acessível de qualquer lugar.",
  },
  {
    icon: Users,
    title: "Gestão de Pacientes",
    description:
      "Centralize dados, contatos e histórico clínico dos seus pacientes em um só lugar, com busca rápida e visão completa.",
  },
  {
    icon: CalendarClock,
    title: "Agendamento Online",
    description:
      "Deixe seus pacientes marcarem consultas sozinhos, com lembretes automáticos que reduzem faltas e reagendamentos.",
  },
  {
    icon: Wallet,
    title: "Financeiro",
    description:
      "Controle recebimentos, repasses e inadimplência com relatórios claros sobre a saúde financeira do seu consultório.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            Psi Rob
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 sm:flex dark:text-zinc-400">
            <a href="#recursos" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Recursos
            </a>
            <a href="#sobre" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Sobre
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Testar Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,theme(colors.brand.100),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,theme(colors.brand.950),transparent_60%)]"
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
            <ShieldCheck className="h-4 w-4" />
            Feito para psicólogos e consultórios
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
            Gestão de consultório de psicologia sem complicação
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            O Psi Rob une prontuário eletrônico, agenda, pacientes e financeiro
            em um só sistema, para que você cuide dos seus pacientes e não da
            planilha.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700"
            >
              Criar minha conta grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que seu consultório precisa
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Quatro pilares que simplificam a rotina clínica e administrativa
              do seu dia a dia.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="bg-zinc-50 px-6 py-24 dark:bg-zinc-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Sobre o Psi Rob
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Construído por quem entende a rotina clínica
            </h2>
            <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              O Psi Rob nasceu para resolver um problema real: psicólogos
              perdendo tempo com burocracia em vez de atendimento. Nossa
              plataforma une segurança, simplicidade e conformidade com o
              Código de Ética do psicólogo em cada funcionalidade.
            </p>
            <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Cada psicólogo tem sua própria conta, agenda e link de
              agendamento — seus dados e os dos seus pacientes ficam
              isolados dos de qualquer outro profissional na plataforma.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              { value: "1.000+", label: "Profissionais ativos" },
              { value: "50 mil+", label: "Sessões registradas" },
              { value: "99,9%", label: "Disponibilidade" },
              { value: "100%", label: "Dados criptografados" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-100 px-6 py-12 dark:border-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Psi Rob
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            <a href="#recursos" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Recursos
            </a>
            <a href="#sobre" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Sobre
            </a>
            <a href="#" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Termos de Uso
            </a>
            <a href="#" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Privacidade
            </a>
          </nav>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} Psi Rob. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
