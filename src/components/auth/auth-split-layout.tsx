"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Moldura de duas colunas pra tela de entrar/criar conta: formulário à
 * esquerda, ilustração à direita (some abaixo de md — a tela de login não
 * pode depender de imagem decorativa pra funcionar no celular).
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

      {/* Mesma ilustração do hero da página inicial, de propósito: quem sai
          do site pra entrar continua vendo a mesma identidade visual, não
          uma foto de banco de imagens desconhecida. */}
      <section className="relative hidden flex-1 p-4 md:block">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="relative h-full w-full overflow-hidden rounded-3xl"
        >
          <Image
            src="/images/hero-autocuidado.webp"
            alt=""
            fill
            sizes="50vw"
            priority
            className="object-cover"
          />
        </motion.div>
      </section>
    </div>
  );
}
