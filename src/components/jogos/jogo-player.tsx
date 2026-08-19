"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enviarRespostaJogo } from "@/lib/jogos-client";
import type { Jogo, PassoJogo, RespostaJogo } from "@/lib/jogos";
import { RespiracaoGuiada } from "@/components/jogos/respiracao-guiada";

/**
 * Traduz a falha de envio para quem está do outro lado — que pode ser uma
 * criança. Mensagem crua do Postgres/PostgREST ("Could not find the function
 * ... in the schema cache") não pode chegar nesta tela: além de não ajudar
 * ninguém, assusta.
 *
 * As duas primeiras já vêm em português das próprias funções do banco (ver
 * responder_jogo_publico em schema.sql), então passam direto.
 */
function mensagemDeErro(erro: unknown): string {
  const bruta = erro instanceof Error ? erro.message : "";
  if (/Link inválido|expirado/i.test(bruta)) {
    return "Este link não está mais válido. Peça um novo para o seu psicólogo.";
  }
  if (/Muitas respostas/i.test(bruta)) {
    return "Muitas respostas enviadas em pouco tempo. Espere alguns minutos e tente de novo.";
  }
  return "Não conseguimos enviar agora. Suas respostas continuam aqui na tela — confira sua internet e toque em Terminar de novo.";
}

/**
 * Roda um jogo do Espaço Interativo, um passo por tela.
 *
 * Nenhum passo é obrigatório de propósito: o exercício é de reflexão, não
 * um formulário. Travar o avanço em pergunta sobre sentimento difícil só
 * empurraria a pessoa a escrever qualquer coisa para se livrar da tela.
 */
export function JogoPlayer({
  jogo,
  token,
  preview = false,
}: {
  jogo: Jogo;
  token: string;
  /** Psicólogo conferindo antes de enviar: joga igual, mas não grava nada. */
  preview?: boolean;
}) {
  const [iniciado, setIniciado] = useState(false);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<RespostaJogo>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const passo = jogo.passos[indice];
  const ultimo = indice === jogo.passos.length - 1;

  function responder(valor: RespostaJogo[string]) {
    setRespostas((prev) => ({ ...prev, [passo.id]: valor }));
  }

  async function finalizar() {
    // Em preview nada é gravado: o psicólogo está só vendo a atividade, e uma
    // resposta de teste dele na ficha do paciente seria lixo no prontuário.
    if (preview) {
      setEnviado(true);
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      await enviarRespostaJogo(createClient(), token, respostas);
      setEnviado(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <Moldura jogo={jogo}>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">
            {preview ? "Fim da visualização" : "Atividade concluída"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {jogo.fechamento}
          </p>
          {preview && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Esta era a visualização da atividade. Nada foi salvo.
            </p>
          )}
        </div>
      </Moldura>
    );
  }

  if (!iniciado) {
    return (
      <Moldura jogo={jogo}>
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            {jogo.duracao}
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {jogo.nome}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {jogo.abertura}
          </p>
          <button
            type="button"
            onClick={() => setIniciado(true)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Começar
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
            {preview
              ? "Visualização: nada do que você responder aqui será salvo."
              : "Suas respostas ficam disponíveis para o seu psicólogo."}
          </p>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura jogo={jogo}>
      <div className="mb-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${((indice + 1) / jogo.passos.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
          {indice + 1} de {jogo.passos.length}
        </p>
      </div>

      <PassoConteudo
        passo={passo}
        valor={respostas[passo.id] ?? null}
        onResponder={responder}
      />

      {erro && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {erro}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
          disabled={indice === 0}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900 disabled:invisible dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {ultimo ? (
          <button
            type="button"
            onClick={finalizar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Terminar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndice((i) => i + 1)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Próxima
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </Moldura>
  );
}

function Moldura({
  jogo,
  children,
}: {
  jogo: Jogo;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-ink-950">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
          {jogo.nome}
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function PassoConteudo({
  passo,
  valor,
  onResponder,
}: {
  passo: PassoJogo;
  valor: RespostaJogo[string];
  onResponder: (valor: RespostaJogo[string]) => void;
}) {
  if (passo.tipo === "respiracao") {
    return (
      <div>
        <h2 className="text-center text-lg font-bold text-zinc-900 dark:text-white">
          {passo.titulo}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {passo.instrucao}
        </p>
        <div className="mt-6">
          <RespiracaoGuiada
            ciclos={passo.ciclos}
            inspirar={passo.inspirar}
            segurar={passo.segurar}
            expirar={passo.expirar}
            onConcluir={() => onResponder("concluido")}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold leading-snug text-zinc-900 dark:text-white">
        {passo.pergunta}
      </h2>
      {passo.ajuda && (
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          {passo.ajuda}
        </p>
      )}

      <div className="mt-5">
        {passo.tipo === "escolha" && (
          <div className="grid gap-2">
            {passo.opcoes.map((opcao) => {
              const marcado = valor === opcao.valor;
              return (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => onResponder(opcao.valor)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    marcado
                      ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
                      : "border-zinc-200 text-zinc-700 hover:border-brand-300 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {opcao.emoji && <span className="text-xl">{opcao.emoji}</span>}
                  {opcao.rotulo}
                </button>
              );
            })}
          </div>
        )}

        {passo.tipo === "texto" &&
          (passo.longo ? (
            <textarea
              rows={5}
              value={typeof valor === "string" ? valor : ""}
              onChange={(e) => onResponder(e.target.value)}
              placeholder={passo.placeholder}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          ) : (
            <input
              type="text"
              value={typeof valor === "string" ? valor : ""}
              onChange={(e) => onResponder(e.target.value)}
              placeholder={passo.placeholder}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          ))}

        {passo.tipo === "escala" && (
          <EscalaPasso
            passo={passo}
            valor={
              valor && typeof valor === "object" && !Array.isArray(valor)
                ? valor
                : {}
            }
            onResponder={onResponder}
          />
        )}

        {passo.tipo === "selecao" && (
          <SelecaoPasso
            passo={passo}
            valor={Array.isArray(valor) ? valor : []}
            onResponder={onResponder}
          />
        )}
      </div>
    </div>
  );
}

function EscalaPasso({
  passo,
  valor,
  onResponder,
}: {
  passo: Extract<PassoJogo, { tipo: "escala" }>;
  valor: Record<string, number>;
  onResponder: (valor: RespostaJogo[string]) => void;
}) {
  return (
    <div className="space-y-5">
      {passo.itens.map((item) => {
        const nota = valor[item.chave];
        return (
          <div key={item.chave}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {item.rotulo}
              </span>
              <span className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-300">
                {nota ?? "—"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={nota ?? 5}
              onChange={(e) =>
                onResponder({ ...valor, [item.chave]: Number(e.target.value) })
              }
              className="mt-2 w-full accent-brand-600"
            />
            <div className="flex justify-between text-[11px] text-zinc-400 dark:text-zinc-600">
              <span>{passo.rotuloMin}</span>
              <span>{passo.rotuloMax}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SelecaoPasso({
  passo,
  valor,
  onResponder,
}: {
  passo: Extract<PassoJogo, { tipo: "selecao" }>;
  valor: string[];
  onResponder: (valor: RespostaJogo[string]) => void;
}) {
  const cheio = valor.length >= passo.maxEscolhas;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {passo.opcoes.map((opcao) => {
          const marcado = valor.includes(opcao);
          // Bloqueia só o que ainda não foi marcado: quem atingiu o limite
          // continua podendo desmarcar para trocar de escolha.
          const bloqueado = cheio && !marcado;
          return (
            <button
              key={opcao}
              type="button"
              disabled={bloqueado}
              onClick={() =>
                onResponder(
                  marcado
                    ? valor.filter((v) => v !== opcao)
                    : [...valor, opcao]
                )
              }
              className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                marcado
                  ? "border-brand-500 bg-brand-600 text-white"
                  : bloqueado
                    ? "border-zinc-100 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700"
                    : "border-zinc-200 text-zinc-700 hover:border-brand-300 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {opcao}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
        {valor.length} de {passo.maxEscolhas} escolhidas
      </p>
    </div>
  );
}
