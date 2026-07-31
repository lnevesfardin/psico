"use client";

import { ExternalLink } from "lucide-react";

/**
 * A busca pública do CFP (cadastro.cfp.org.br) roda atrás de reCAPTCHA v3 —
 * não dá pra consultar por trás (fetch/scraping) sem contornar o captcha,
 * o que não fazemos. Em vez de fingir uma validação automática, abrimos a
 * busca oficial numa aba nova para conferência manual; a confirmação do
 * status ainda depende de alguém da equipe revisar depois.
 */
export function ValidarCrpButton({ crp, crpUf }: { crp: string; crpUf: string }) {
  const disabled = !crp || !crpUf;

  function handleClick() {
    if (disabled) return;
    window.open("https://cadastro.cfp.org.br", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline dark:text-brand-400"
      >
        <ExternalLink className="h-4 w-4" />
        Validar CRP no site do CFP
      </button>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {disabled
          ? "Preencha o CRP e a UF para validar."
          : `Busque por "${crp} - ${crpUf}" na página que abrir. Depois de conferir, nossa equipe confirma o status na sua conta.`}
      </p>
    </div>
  );
}
