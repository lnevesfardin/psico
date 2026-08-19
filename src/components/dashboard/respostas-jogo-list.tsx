"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  apagarRespostaJogo,
  listRespostasJogoPaciente,
  type RespostaJogoRegistro,
} from "@/lib/jogos-client";
import { getJogo, PUBLICO_LABELS, type PassoJogo } from "@/lib/jogos";
import { formatDateTime } from "@/lib/format";

/**
 * Respostas das atividades do Espaço Interativo, na ficha do paciente.
 *
 * De propósito não há pontuação, faixa nem alerta aqui — diferente de
 * respostas-escala-list.tsx. Estes exercícios não medem nada; o valor é o
 * que a pessoa escreveu, então a tela só devolve as perguntas com as
 * respostas ao lado, para virar assunto de sessão.
 */
export function RespostasJogoList({ pacienteId }: { pacienteId: string }) {
  const [respostas, setRespostas] = useState<RespostaJogoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [apagandoId, setApagandoId] = useState<string | null>(null);

  useEffect(() => {
    listRespostasJogoPaciente(createClient(), pacienteId)
      .then(setRespostas)
      // Tabela pode não existir ainda (schema aplicado à mão): lista vazia
      // é melhor do que um erro que o psicólogo não tem como resolver.
      .catch(() => setRespostas([]))
      .finally(() => setLoading(false));
  }, [pacienteId]);

  async function handleApagar(registro: RespostaJogoRegistro) {
    const jogo = getJogo(registro.jogo);
    const confirmado = window.confirm(
      `Apagar a resposta de "${jogo?.nome ?? registro.jogo}" de ${formatDateTime(registro.createdAt)}? Não pode ser desfeito.`
    );
    if (!confirmado) return;

    setApagandoId(registro.id);
    try {
      await apagarRespostaJogo(createClient(), registro.id);
      setRespostas((prev) => prev.filter((r) => r.id !== registro.id));
    } catch {
      window.alert("Não foi possível apagar a resposta.");
    } finally {
      setApagandoId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
    );
  }

  if (respostas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Nenhuma atividade respondida ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {respostas.map((registro) => {
        const jogo = getJogo(registro.jogo);
        const aberto = abertoId === registro.id;

        return (
          <div
            key={registro.id}
            className="overflow-hidden rounded-xl border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={() => setAbertoId(aberto ? null : registro.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                  {jogo?.nome ?? registro.jogo}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {jogo ? `${PUBLICO_LABELS[jogo.publico]} · ` : ""}
                  {formatDateTime(registro.createdAt)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleApagar(registro)}
                disabled={apagandoId === registro.id}
                aria-label="Apagar resposta"
                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950 dark:hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronDown
                onClick={() => setAbertoId(aberto ? null : registro.id)}
                className={`h-4 w-4 shrink-0 cursor-pointer text-zinc-400 transition-transform ${
                  aberto ? "rotate-180" : ""
                }`}
              />
            </div>

            {aberto && (
              <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
                {jogo ? (
                  jogo.passos.map((passo) => (
                    <RespostaDoPasso
                      key={passo.id}
                      passo={passo}
                      valor={registro.respostas[passo.id] ?? null}
                    />
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Esta atividade não está mais no catálogo. Respostas brutas:{" "}
                    {JSON.stringify(registro.respostas)}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RespostaDoPasso({
  passo,
  valor,
}: {
  passo: PassoJogo;
  valor: string | string[] | Record<string, number> | null;
}) {
  const pergunta = passo.tipo === "respiracao" ? passo.titulo : passo.pergunta;

  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {pergunta}
      </p>
      <div className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
        <Valor passo={passo} valor={valor} />
      </div>
    </div>
  );
}

function Valor({
  passo,
  valor,
}: {
  passo: PassoJogo;
  valor: string | string[] | Record<string, number> | null;
}) {
  if (valor === null || valor === "" || (Array.isArray(valor) && valor.length === 0)) {
    return <span className="text-zinc-300 dark:text-zinc-700">Não respondeu</span>;
  }

  if (passo.tipo === "respiracao") {
    return <span className="text-emerald-600 dark:text-emerald-400">Concluído</span>;
  }

  if (passo.tipo === "escolha" && typeof valor === "string") {
    const opcao = passo.opcoes.find((o) => o.valor === valor);
    return (
      <span>
        {opcao?.emoji} {opcao?.rotulo ?? valor}
      </span>
    );
  }

  if (Array.isArray(valor)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {valor.map((v) => (
          <span
            key={v}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
          >
            {v}
          </span>
        ))}
      </span>
    );
  }

  if (passo.tipo === "escala" && typeof valor === "object") {
    return (
      <ul className="mt-1 space-y-1">
        {passo.itens.map((item) => (
          <li key={item.chave} className="flex items-center gap-2 text-xs">
            <span className="w-40 shrink-0 text-zinc-500 dark:text-zinc-400">
              {item.rotulo}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span
                className="block h-full rounded-full bg-brand-500"
                style={{ width: `${((valor[item.chave] ?? 0) / 10) * 100}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
              {valor[item.chave] ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  // Texto livre: preserva as quebras de linha que a pessoa escreveu.
  return <span className="whitespace-pre-wrap">{String(valor)}</span>;
}
