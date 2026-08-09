"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { responderEscala } from "@/lib/instrumentos-client";
import { calcularEscore, respostasCompletas, type ItensInstrumento, type FaixasInstrumento } from "@/lib/instrumentos/scoring";

export function EscalaResponder({
  token,
  sigla,
  itens,
  faixas,
}: {
  token: string;
  sigla: string;
  nome: string;
  itens: ItensInstrumento;
  faixas: FaixasInstrumento;
}) {
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const completo = respostasCompletas({ sigla, itens, faixas }, respostas);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo) return;
    setEnviando(true);
    setErro(null);
    try {
      const resultado = calcularEscore({ sigla, itens, faixas }, respostas);
      const supabase = createClient();
      await responderEscala(supabase, token, {
        respostas,
        escore: resultado.escore,
        faixa: resultado.faixa,
        resultadoDetalhado: resultado.detalhado,
      });
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar suas respostas.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Respostas enviadas com sucesso.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Seu psicólogo vai analisar o resultado. Você já pode fechar esta página.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {erro}
        </div>
      )}

      {itens.perguntas.map((pergunta) => (
        <fieldset key={pergunta.numero}>
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {pergunta.numero}. {pergunta.texto}
          </legend>
          <div className="mt-2 space-y-1.5">
            {itens.opcoes.map((opcao) => (
              <label
                key={opcao.valor}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  respostas[pergunta.numero] === opcao.valor
                    ? "border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-100"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="radio"
                  name={`pergunta-${pergunta.numero}`}
                  value={opcao.valor}
                  checked={respostas[pergunta.numero] === opcao.valor}
                  onChange={() =>
                    setRespostas((prev) => ({ ...prev, [pergunta.numero]: opcao.valor }))
                  }
                  className="h-4 w-4 accent-brand-600"
                />
                {opcao.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <button
        type="submit"
        disabled={!completo || enviando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar respostas
      </button>
      {!completo && (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          Responda todas as perguntas para enviar.
        </p>
      )}
    </form>
  );
}
