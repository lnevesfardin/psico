"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, FileText, Wallet } from "lucide-react";
import { motion } from "framer-motion";

const RECURSOS_PAINEL = [
  { icon: FileText, label: "Prontuário eletrônico seguro" },
  { icon: CalendarClock, label: "Agendamento com lembretes automáticos" },
  { icon: Wallet, label: "Financeiro sem planilha" },
];

/**
 * Moldura de duas colunas pra tela de entrar/criar conta: formulário à
 * esquerda, painel de marca à direita (some abaixo de md — a tela de login
 * não pode depender dele pra funcionar no celular).
 *
 * Só a moldura. A lógica de autenticação continua inteira no AuthForm —
 * Supabase, Google, recuperação de senha, verificação por código — nada
 * disso muda aqui, só o layout ao redor.
 */
export function AuthSplitLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen font-sans">
      <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Menu Inicial
          </Link>

          <Link
            href="/"
            className="mb-8 flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
            Psico
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8"
          >
            {children}
          </motion.div>
        </div>
      </section>

      {/* Painel de marca, não uma foto: nenhuma imagem do acervo do site
          tinha o enquadramento certo pra uma coluna alta e estreita (a do
          hero corta mal, a de "passos-fundo" é uma foto de banco de imagens
          genérica, sem relação com psicologia). Gradiente + mesmos ícones
          das features da página inicial mantém a identidade visual sem
          depender de uma imagem. */}
      <section className="relative hidden flex-1 p-4 md:block">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br from-ink-900 to-brand-950 p-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-400/25 blur-[100px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-brand-300/10 blur-[100px]"
          />

          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-4 w-4 invert" />
          </div>

          <div className="relative">
            <p className="text-2xl font-semibold leading-snug text-white">
              Cuide dos seus pacientes.
              <br />
              O Psico cuida do resto.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              Prontuário, agenda, pacientes e financeiro em um só lugar — pra
              sobrar mais tempo pra escutar.
            </p>

            <ul className="mt-8 space-y-3.5">
              {RECURSOS_PAINEL.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 text-sm font-medium text-white/80"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
