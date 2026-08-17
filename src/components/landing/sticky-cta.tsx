"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RESPOSTA_PROMESSA } from "@/lib/site";

/**
 * Barra de ação fixa no rodapé do mobile, onde o CTA do topo já saiu da tela
 * há muito scroll. Só aparece depois do hero pra não cobrir o próprio botão
 * principal logo na chegada.
 *
 * O padding esquerdo é o que reserva o canto do seletor de tema (fixo em
 * bottom-4 left-4 no layout raiz), que flutua acima desta barra.
 */
export function StickyCta() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > 700);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 py-3 pl-20 pr-4 backdrop-blur-sm transition-all duration-300 lg:hidden dark:border-white/10 dark:bg-ink-950/95 ${
        visivel
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <Link
        href="/cadastro"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform duration-300 active:scale-95"
      >
        Criar minha conta grátis
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-1.5 text-center text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
        Teste grátis · {RESPOSTA_PROMESSA}
      </p>
    </div>
  );
}
