"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarClock,
  FileText,
  Users,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Star,
  Check,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

// Depoimentos ilustrativos — trocar por relatos reais de clientes antes de
// publicar a página em produção.
const testimonials = [
  {
    quote:
      "O Psi Rob organizou minha agenda e meus prontuários em um só lugar. Deixei de perder tempo com planilha e caderno.",
    name: "Mariana T.",
    role: "Psicóloga Clínica",
  },
  {
    quote:
      "Meus pacientes marcam consulta sozinhos pelo link e eu só confirmo pelo WhatsApp. Reduziu bastante as faltas.",
    name: "Carlos E.",
    role: "Psicólogo · Terapia Cognitivo-Comportamental",
  },
  {
    quote:
      "A parte financeira me mostra rapidinho quem já pagou e quem está pendente, sem precisar abrir planilha nenhuma.",
    name: "Ana Paula R.",
    role: "Psicóloga · Consultório Particular",
  },
];

// Valores ilustrativos — ajustar antes de publicar.
const plans = [
  {
    name: "Mensal",
    price: "R$ 49",
    period: "/mês",
    description: "Ideal para começar sem compromisso.",
    highlighted: false,
  },
  {
    name: "Anual",
    price: "R$ 39",
    period: "/mês",
    description: "Equivalente a 2 meses grátis, cobrado uma vez por ano.",
    highlighted: true,
  },
];

const planFeatures = [
  "Agenda e agendamento online ilimitados",
  "Prontuário eletrônico e histórico de sessões",
  "Gestão de pacientes sem limite de cadastros",
  "Controle financeiro por paciente",
  "Link de agendamento personalizado",
];

const faq = [
  {
    question: "Meus dados e os dos meus pacientes estão seguros?",
    answer:
      "Sim. Cada psicólogo tem sua própria conta isolada, com acesso protegido por login e regras de segurança em nível de banco de dados — nenhum outro profissional consegue ver seus pacientes ou prontuários.",
  },
  {
    question: "Preciso instalar algum programa?",
    answer:
      "Não. O Psi Rob funciona direto no navegador, em qualquer computador ou celular, sem instalação.",
  },
  {
    question: "O agendamento online funciona para pacientes sem conta?",
    answer:
      "Sim. Você compartilha o seu link de agendamento e qualquer pessoa consegue marcar uma consulta nos horários que você disponibilizar, sem precisar criar conta.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim, não há fidelidade. Você pode cancelar a qualquer momento diretamente no seu perfil.",
  },
];

const navLinks = [
  { href: "#recursos", label: "Recursos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#depoimentos", label: "Depoimentos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-[85rem] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
              Psi Rob
            </div>
          </div>

          <nav className="hidden items-center gap-10 text-sm font-medium text-zinc-600 lg:flex dark:text-zinc-400">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Online · horários disponíveis esta semana
            </span>
            <Link
              href="/login"
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors duration-300 ease-in-out hover:bg-zinc-50 sm:px-4 sm:py-2 sm:text-sm dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-300 ease-in-out hover:scale-[1.03] hover:bg-zinc-700 active:scale-95 sm:px-4 sm:py-2 sm:text-sm dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Testar Grátis
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="flex flex-col gap-1 border-t border-zinc-100 px-6 py-3 text-sm font-medium text-zinc-600 lg:hidden dark:border-zinc-900 dark:text-zinc-400">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                {label}
              </a>
            ))}
            <div className="mt-1 px-2 py-1.5 sm:hidden">
              <ThemeToggle />
            </div>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-28 sm:py-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,theme(colors.brand.100),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,theme(colors.brand.950),transparent_60%)]"
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300"
          >
            <ShieldCheck className="h-4 w-4" />
            Feito para psicólogos e consultórios
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-6xl dark:text-white"
          >
            Gestão de consultório de psicologia sem complicação
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 max-w-xl text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            O Psi Rob une prontuário eletrônico, agenda, pacientes e financeiro
            em um só sistema, para que você cuide dos seus pacientes e não da
            planilha.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition-all duration-300 ease-in-out hover:scale-[1.03] hover:bg-brand-700 active:scale-95"
            >
              Criar minha conta grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que seu consultório precisa
            </h2>
            <p className="mt-4 text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              Quatro pilares que simplificam a rotina clínica e administrativa
              do seu dia a dia.
            </p>
          </Reveal>
          <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="group relative h-full"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-400/0 to-brand-300/0 opacity-0 blur-2xl transition-opacity duration-400 ease-in-out group-hover:from-brand-400/40 group-hover:to-brand-200/20 group-hover:opacity-100 dark:group-hover:from-brand-500/30 dark:group-hover:to-brand-400/10"
                  />
                  <div className="relative h-full rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition-shadow duration-300 ease-in-out group-hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {description}
                    </p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="bg-zinc-50 px-6 py-24 lg:py-32 dark:bg-zinc-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Sobre o Psi Rob
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Construído por quem entende a rotina clínica
            </h2>
            <p className="mt-6 text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              O Psi Rob nasceu para resolver um problema real: psicólogos
              perdendo tempo com burocracia em vez de atendimento. Nossa
              plataforma une segurança, simplicidade e conformidade com o
              Código de Ética do psicólogo em cada funcionalidade.
            </p>
            <p className="mt-4 text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              Cada psicólogo tem sua própria conta, agenda e link de
              agendamento — seus dados e os dos seus pacientes ficam
              isolados dos de qualquer outro profissional na plataforma.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="grid grid-cols-2 gap-6">
            {[
              { value: "1.000+", label: "Profissionais ativos" },
              { value: "50 mil+", label: "Sessões registradas" },
              { value: "99,9%", label: "Disponibilidade" },
              { value: "100%", label: "Dados criptografados" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm font-normal text-zinc-600 dark:text-zinc-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Quem usa, recomenda
            </h2>
            <p className="mt-4 text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              Psicólogos que trocaram planilha e caderno pelo Psi Rob.
            </p>
          </Reveal>
          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="group relative h-full"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-4 rounded-3xl bg-brand-300/0 opacity-0 blur-2xl transition-opacity duration-400 ease-in-out group-hover:bg-brand-300/30 group-hover:opacity-100 dark:group-hover:bg-brand-500/20"
                  />
                  <div className="relative flex h-full flex-col rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star key={starIndex} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="mt-5 flex-1 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="mt-8 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {t.name}
                      </p>
                      <p className="text-xs font-normal text-zinc-500 dark:text-zinc-500">
                        {t.role}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="bg-zinc-50 px-6 py-24 lg:py-32 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Planos para todo tamanho de consultório
            </h2>
            <p className="mt-4 text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              Comece grátis, sem cartão de crédito. Cancele quando quiser.
            </p>
          </Reveal>
          <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {plans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div
                  className={`relative h-full rounded-2xl border p-8 ${
                    plan.highlighted
                      ? "border-brand-300 bg-white shadow-xl shadow-brand-600/10 dark:border-brand-800 dark:bg-zinc-900"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                      Mais popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {plan.description}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                      {plan.period}
                    </span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {planFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/cadastro"
                    className={`mt-8 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 ease-in-out hover:scale-[1.02] active:scale-95 ${
                      plan.highlighted
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    }`}
                  >
                    Testar Grátis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Perguntas frequentes
            </h2>
          </Reveal>
          <div className="mt-16 divide-y divide-zinc-100 border-t border-b border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            {faq.map((item, i) => (
              <Reveal key={item.question} delay={i * 0.06}>
                <FaqItem question={item.question} answer={item.answer} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-100 px-6 py-16 dark:border-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
            Psi Rob
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm font-normal text-zinc-600 dark:text-zinc-400">
            <a href="#recursos" className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white">
              Recursos
            </a>
            <a href="#sobre" className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white">
              Sobre
            </a>
            <a href="#" className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white">
              Termos de Uso
            </a>
            <a href="#" className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white">
              Privacidade
            </a>
          </nav>
          <p className="text-sm font-normal text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} Psi Rob. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-semibold text-zinc-900 transition-colors duration-300 ease-in-out hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
        aria-expanded={open}
      >
        {question}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ease-in-out ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
