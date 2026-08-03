"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CalendarCheck,
  FileText,
  Users,
  Wallet,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Star,
  Check,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Search,
  UserPlus,
  BellRing,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

/** Superfície padrão dos cards: sutil no claro, translúcida no escuro. */
const cardBase =
  "rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none dark:backdrop-blur-sm";

const cardHover =
  "hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl dark:hover:border-brand-500/50";

/** Halo desfocado de fundo — só decorativo, nunca captura clique. */
function Glow({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -z-10 rounded-full blur-[110px] ${className}`}
    />
  );
}

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

// Depoimentos ilustrativos — trocar por relatos reais de clientes (e fotos
// com autorização, no lugar das iniciais) antes de publicar em produção.
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
  { href: "#como-funciona", label: "Como Funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#depoimentos", label: "Depoimentos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

// Link do aviso de segurança fica fora de navLinks: precisa de estilo
// destacado (cor de alerta) em vez de se misturar com a navegação comum.
const safetyLink = { href: "#seguranca", label: "Aviso de Segurança" };

type Fluxo = "psicologo" | "paciente";

const howItWorks: Record<
  Fluxo,
  { icon: typeof Search; title: string; description: string }[]
> = {
  paciente: [
    {
      icon: Search,
      title: "Encontre um profissional",
      description:
        "Acesse a página de agendamento — ou o link direto de um psicólogo — sem precisar criar conta.",
    },
    {
      icon: ShieldCheck,
      title: "Confira o perfil completo",
      description:
        "Compare especialidade, abordagem, faixa etária atendida, região e valor da consulta.",
    },
    {
      icon: CalendarCheck,
      title: "Escolha dia e horário",
      description:
        "Veja os horários realmente disponíveis, escolha presencial ou online e preencha seus dados.",
    },
    {
      icon: BellRing,
      title: "Receba a confirmação",
      description:
        "Acompanhe tudo em “Meus Agendamentos” e receba a confirmação do psicólogo.",
    },
  ],
  psicologo: [
    {
      icon: UserPlus,
      title: "Crie sua conta gratuita",
      description:
        "Monte seu perfil: CRP, abordagem, especialidades e valor da consulta.",
    },
    {
      icon: CalendarClock,
      title: "Configure sua disponibilidade",
      description:
        "Defina dias, horários e modalidade e compartilhe seu link de agendamento público.",
    },
    {
      icon: FileText,
      title: "Gerencie pacientes e prontuários",
      description:
        "Agenda, cadastro de pacientes e prontuário eletrônico em um só lugar.",
    },
    {
      icon: Wallet,
      title: "Acompanhe o financeiro",
      description:
        "Controle recebimentos e acompanhe os agendamentos feitos pelos seus clientes.",
    },
  ],
};

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fluxo, setFluxo] = useState<Fluxo>("psicologo");

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 dark:bg-ink-950 dark:text-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md dark:border-white/5 dark:bg-ink-950/80">
        <div className="mx-auto flex max-w-[85rem] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:hover:bg-white/5"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
              Psi Rob
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 lg:flex dark:text-zinc-400">
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
            <Link
              href="/login"
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors duration-300 ease-in-out hover:bg-zinc-50 sm:px-4 sm:py-2 sm:text-sm dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 transition-all duration-300 ease-in-out hover:scale-[1.03] hover:bg-brand-500 active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
            >
              Testar Grátis
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="flex flex-col gap-1 border-t border-zinc-100 px-6 py-3 text-sm font-medium text-zinc-600 lg:hidden dark:border-white/5 dark:text-zinc-400">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 sm:py-28 lg:py-32">
        <Glow className="left-1/2 top-[-8rem] h-[34rem] w-[34rem] -translate-x-1/2 bg-brand-300/40 dark:bg-brand-500/15" />
        <Glow className="right-[-6rem] top-[10rem] h-[22rem] w-[22rem] bg-sky-200/30 dark:bg-sky-500/10" />

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-4 py-1.5 text-sm font-medium text-brand-700 backdrop-blur-sm dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300"
            >
              <Sparkles className="h-4 w-4" />
              A plataforma simples para psicólogos focarem no que importa: pessoas.
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
              className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            >
              <Link
                href="/cadastro"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-300 ease-in-out hover:scale-[1.03] hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-500/30 active:scale-95"
              >
                Criar minha conta grátis
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-8 py-3.5 text-base font-semibold text-zinc-700 backdrop-blur-sm transition-all duration-300 ease-in-out hover:border-brand-300 hover:bg-white active:scale-95 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:border-brand-500/50 dark:hover:bg-white/10"
              >
                Ver como funciona
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
            >
              <div className="flex -space-x-2">
                {["MT", "CE", "AP", "LF"].map((iniciais, i) => (
                  <span
                    key={iniciais}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-brand-800 dark:border-ink-950 ${
                      ["bg-brand-200", "bg-brand-300", "bg-brand-100", "bg-brand-200"][i]
                    }`}
                  >
                    {iniciais}
                  </span>
                ))}
              </div>
              <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  +1.000 psicólogos
                </span>{" "}
                já simplificaram a rotina clínica
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <Glow className="left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 bg-brand-300/30 dark:bg-brand-500/10" />

            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200/80 shadow-2xl shadow-brand-950/10 dark:border-white/10 dark:shadow-black/30">
              <Image
                src="/images/hero-autocuidado.webp"
                alt="Pessoa em um momento de autocuidado em casa, sorrindo ao conferir a agenda de consultas pelo celular"
                width={1120}
                height={896}
                sizes="(min-width: 1024px) 480px, (min-width: 640px) 420px, 100vw"
                preload
                className="h-auto w-full"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="absolute -left-4 top-6 hidden items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:flex dark:border-white/10 dark:bg-ink-900/95"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <BellRing className="h-4 w-4" />
              </span>
              <div className="text-left">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Lembrete enviado
                </p>
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Consulta às 15h
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.85 }}
              className="absolute -right-4 bottom-8 hidden items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:flex dark:border-white/10 dark:bg-ink-900/95"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CalendarCheck className="h-4 w-4" />
              </span>
              <div className="text-left">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Consulta confirmada
                </p>
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Com a Dra. Ana
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Como Funciona */}
      <section
        id="como-funciona"
        className="relative overflow-hidden bg-zinc-50 px-6 py-24 lg:py-32 dark:bg-ink-900/60"
      >
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Como funciona
            </h2>
            <p className="mt-4 text-lg font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              O Psi Rob funciona de um jeito para quem atende e de outro para
              quem busca atendimento. Escolha o seu lado.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-10 flex justify-center">
            <div
              role="tablist"
              aria-label="Escolha o fluxo"
              className="inline-flex rounded-full border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04]"
            >
              {(
                [
                  { value: "psicologo", label: "Sou Psicólogo" },
                  { value: "paciente", label: "Sou Paciente" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={fluxo === value}
                  onClick={() => setFluxo(value)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                    fluxo === value
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Reveal>

          <motion.div
            key={fluxo}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2"
          >
            {howItWorks[fluxo].map(({ icon: Icon, title, description }, i) => (
              <div key={title} className={`${cardBase} ${cardHover} p-6`}>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                      Passo {i + 1}
                    </p>
                    <h3 className="mt-1 font-semibold text-zinc-900 dark:text-white">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          <Reveal delay={0.2} className="mt-10 flex justify-center">
            <Link
              href={
                fluxo === "psicologo"
                  ? "/cadastro?perfil=psicologo"
                  : "/cadastro?perfil=cliente"
              }
              className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:bg-brand-500 active:scale-95"
            >
              {fluxo === "psicologo"
                ? "Criar minha conta grátis"
                : "Encontrar um psicólogo"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="relative overflow-hidden px-6 py-24 lg:py-32">
        <Glow className="left-[-8rem] top-[6rem] h-[26rem] w-[26rem] bg-brand-200/40 dark:bg-brand-500/10" />
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
          <div className="mt-20 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div className={`${cardBase} ${cardHover} h-full p-6`}>
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section
        id="sobre"
        className="bg-zinc-50 px-6 py-24 lg:py-32 dark:bg-ink-900/60"
      >
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
          <Reveal delay={0.15} className="grid grid-cols-2 gap-5">
            {[
              { value: "1.000+", label: "Profissionais ativos" },
              { value: "50 mil+", label: "Sessões registradas" },
              { value: "99,9%", label: "Disponibilidade" },
              { value: "100%", label: "Dados criptografados" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`${cardBase} ${cardHover} p-8 text-center`}
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
          <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <div
                  className={`${cardBase} ${cardHover} relative flex h-full flex-col overflow-hidden p-8`}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-2 -top-6 select-none text-[7rem] leading-none text-brand-500/10 dark:text-brand-400/10"
                  >
                    &rdquo;
                  </span>
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star key={starIndex} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="relative mt-5 flex-1 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {t.quote}
                  </p>
                  <div className="mt-8 flex items-center gap-3 border-t border-zinc-100 pt-5 dark:border-white/10">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      {t.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {t.name}
                      </p>
                      <p className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        {t.role}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section
        id="planos"
        className="relative overflow-hidden bg-zinc-50 px-6 py-24 lg:py-32 dark:bg-ink-900/60"
      >
        <Glow className="left-1/2 top-[4rem] h-[30rem] w-[30rem] -translate-x-1/2 bg-brand-300/30 dark:bg-brand-500/12" />
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
                  className={`relative h-full rounded-2xl border p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:shadow-none dark:backdrop-blur-sm ${
                    plan.highlighted
                      ? "border-brand-300 bg-white shadow-xl shadow-brand-600/10 dark:border-brand-500/40 dark:bg-brand-500/[0.07]"
                      : "border-zinc-200 bg-white hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-500/50"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-brand-600/30">
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
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/cadastro"
                    className={`mt-8 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 ease-in-out hover:scale-[1.02] active:scale-95 ${
                      plan.highlighted
                        ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500"
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
          <div className="mt-16 space-y-3">
            {faq.map((item, i) => (
              <Reveal key={item.question} delay={i * 0.06}>
                <FaqItem question={item.question} answer={item.answer} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Aviso de Segurança */}
      <section id="seguranca" className="px-6 pb-24 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 sm:p-8 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">
            <div className="flex flex-col items-center gap-3 text-center">
              <ShieldAlert className="h-7 w-7 shrink-0" />
              <p className="text-sm leading-relaxed sm:text-base">
                <strong>Aviso de Segurança:</strong> Esta plataforma não é um
                canal de socorro nem oferece auxílio imediato para pessoas em
                risco de suicídio. Em momentos de crise, busque ajuda pelo
                telefone{" "}
                <a
                  href="tel:188"
                  className="font-bold text-amber-600 underline decoration-2 underline-offset-4 transition-colors hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  188
                </a>{" "}
                (CVV) ou pelo site{" "}
                <a
                  href="https://www.cvv.org.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-amber-600 underline decoration-2 underline-offset-4 transition-colors hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  www.cvv.org.br
                </a>
                . Em emergências, vá sem hesitar à unidade hospitalar mais
                próxima.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-100 px-6 py-16 dark:border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
            Psi Rob
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm font-normal text-zinc-600 dark:text-zinc-400">
            <a
              href="#recursos"
              className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white"
            >
              Recursos
            </a>
            <a
              href="#sobre"
              className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white"
            >
              Sobre
            </a>
            <a
              href={safetyLink.href}
              className="inline-flex items-center gap-1.5 font-semibold text-rose-600 transition-colors duration-300 ease-in-out hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {safetyLink.label}
            </a>
            <a
              href="#"
              className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white"
            >
              Termos de Uso
            </a>
            <a
              href="#"
              className="transition-colors duration-300 ease-in-out hover:text-zinc-900 dark:hover:text-white"
            >
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
    <div
      className={`overflow-hidden rounded-xl border transition-colors duration-300 ${
        open
          ? "border-brand-300 bg-brand-50/40 dark:border-brand-500/40 dark:bg-brand-500/[0.06]"
          : "border-zinc-200 bg-white hover:border-brand-200 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-zinc-900 transition-colors duration-300 ease-in-out hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
        aria-expanded={open}
      >
        {question}
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            open
              ? "rotate-180 bg-brand-600 text-white"
              : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
