"use client";

import { useMemo, useState } from "react";
import { Flame, Sparkles, X } from "lucide-react";
import {
  PATIENT_GAMES,
  temasDisponiveis,
  type PatientGame,
} from "@/lib/patient-games";
import { PatientGameCard } from "@/components/client-area/patient-game-card";
import {
  PatientFilterBar,
  type GameTab,
} from "@/components/client-area/patient-filter-bar";

/**
 * Cada aba responde a uma pergunta do paciente: "o que é pra mim agora",
 * "o que chegou de novo", "o que eu já fiz".
 *
 * Atividade começada entra em "Para Você" mesmo sem ser recomendada — deixar
 * algo pela metade fora da primeira aba seria esconder justamente o que a
 * pessoa tem mais chance de querer terminar.
 */
function pertenceAba(game: PatientGame, tab: GameTab): boolean {
  if (tab === "concluidos") return game.status === "completed";
  if (tab === "novidades") return game.status === "new";
  return game.status === "in_progress" || (game.isRecommended && game.status !== "completed");
}

export function PatientGameCatalog({
  games = PATIENT_GAMES,
}: {
  games?: PatientGame[];
}) {
  const [tab, setTab] = useState<GameTab>("para-voce");
  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState("");
  const [aberto, setAberto] = useState<PatientGame | null>(null);

  const temas = useMemo(() => temasDisponiveis(games), [games]);

  const contagem = useMemo(
    () => ({
      "para-voce": games.filter((g) => pertenceAba(g, "para-voce")).length,
      novidades: games.filter((g) => pertenceAba(g, "novidades")).length,
      concluidos: games.filter((g) => pertenceAba(g, "concluidos")).length,
    }),
    [games]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return games.filter((game) => {
      if (!pertenceAba(game, tab)) return false;
      if (tema && !game.tags.includes(tema)) return false;
      if (!q) return true;
      return (
        game.title.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        game.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [games, tab, tema, busca]);

  const concluidas = games.filter((g) => g.status === "completed").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            <Sparkles className="h-6 w-6 text-brand-500" />
            Seu Espaço Interativo
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Atividades e reflexões escolhidas especialmente para o seu
            desenvolvimento.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
            <Flame className="h-3.5 w-3.5" />3 dias seguidos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            {concluidas} concluídas
          </span>
        </div>
      </header>

      <PatientFilterBar
        tab={tab}
        onTabChange={setTab}
        busca={busca}
        onBuscaChange={setBusca}
        tema={tema}
        onTemaChange={setTema}
        temas={temas}
        contagem={contagem}
      />

      {visiveis.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-400 dark:border-white/10 dark:text-zinc-500">
          {busca || tema
            ? "Nenhuma atividade encontrada com esses filtros."
            : tab === "concluidos"
              ? "Você ainda não concluiu nenhuma atividade. Que tal começar por uma?"
              : "Nada por aqui ainda. Seu psicólogo envia atividades novas quando fizer sentido para você."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiveis.map((game) => (
            <PatientGameCard key={game.id} game={game} onStart={setAberto} />
          ))}
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAberto(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setAberto(null)}
              aria-label="Fechar"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {aberto.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Esta atividade ainda está sendo preparada. Em breve ela abre aqui
              mesmo, com as perguntas para você responder no seu ritmo.
            </p>
            <button
              type="button"
              onClick={() => setAberto(null)}
              className="mt-5 w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
