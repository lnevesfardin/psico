"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { ESCALAS_DISPONIVEIS, type EscalaSlug } from "@/lib/escalas";
import { gerarConviteEscala } from "@/lib/respostas-escala-client";
import { APRESENTACAO } from "@/lib/patient-activities";

// Só escalas aqui. As atividades do Espaço Interativo saem da própria seção
// no menu (/dashboard/espaco-interativo), onde dá para ver cada uma antes de
// mandar — misturar as duas coisas neste seletor escondia os jogos dentro de
// uma aba chamada "Rastreio", que é outro assunto.

/**
 * Envia uma atividade direto da ficha, em vez de obrigar o desvio por
 * "Meu Link" → escolher o paciente de novo numa lista.
 *
 * Se o paciente tem conta, o convite já aparece no Espaço Interativo dele
 * (ver minhas_atividades no schema.sql) — o link copiado continua existindo
 * para quem prefere mandar por WhatsApp, ou para quem ainda não tem conta.
 */
export function EnviarAtividade({
  pacienteId,
  temConta,
}: {
  pacienteId: string;
  temConta: boolean;
}) {
  const { user } = useAuth();
  const [selecao, setSelecao] = useState<EscalaSlug | "">("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function handleEnviar() {
    if (!selecao || !user) return;
    setEnviando(true);
    setErro(null);
    setLink(null);
    try {
      const token = await gerarConviteEscala(
        createClient(),
        pacienteId,
        selecao
      );
      setLink(
        `${window.location.origin}/escala/${user.id}/${selecao}?c=${token}`
      );
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar a atividade."
      );
    } finally {
      setEnviando(false);
    }
  }

  async function handleCopiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
        Enviar escala de rastreio
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {temConta
          ? "A escala aparece no Espaço Interativo do paciente assim que você enviar. O link abaixo serve se preferir mandar por WhatsApp."
          : "Este paciente ainda não tem conta, então envie o link pelo WhatsApp. Com conta, a escala apareceria sozinha no Espaço Interativo dele."}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={selecao}
          onChange={(e) => {
            setSelecao(e.target.value as EscalaSlug | "");
            setLink(null);
          }}
          aria-label="Escolher escala"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          <option value="">Escolha uma escala...</option>
          {ESCALAS_DISPONIVEIS.map((escala) => (
            <option key={escala.slug} value={escala.slug}>
              {APRESENTACAO[escala.slug].title} ({escala.slug.toUpperCase()})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleEnviar}
          disabled={!selecao || enviando}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar
        </button>
      </div>

      {erro && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{erro}</p>
      )}

      {link && (
        <div className="mt-3">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {temConta
              ? "Pronto — já está no Espaço Interativo do paciente."
              : "Atividade criada. Copie e envie o link."}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="w-full truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            />
            <button
              type="button"
              onClick={handleCopiar}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copiado ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
