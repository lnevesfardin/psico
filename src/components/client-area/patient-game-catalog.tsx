"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import {
  apresentacaoDa,
  ehNovidade,
  listMinhasAtividades,
  type AtividadePaciente,
} from "@/lib/patient-activities";
import { PatientActivityCard } from "@/components/client-area/patient-activity-card";
import {
  PatientFilterBar,
  type GameTab,
} from "@/components/client-area/patient-filter-bar";

/**
 * Cada aba responde a uma pergunta do paciente: "o que falta responder",
 * "o que chegou agora", "o que eu já respondi".
 */
function pertenceAba(atividade: AtividadePaciente, tab: GameTab): boolean {
  if (tab === "concluidos") return Boolean(atividade.respondidoEm);
  if (tab === "novidades") return ehNovidade(atividade);
  return !atividade.respondidoEm;
}

export function PatientGameCatalog() {
  const { user } = useAuth();
  const [atividades, setAtividades] = useState<AtividadePaciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tab, setTab] = useState<GameTab>("para-voce");
  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState("");

  useEffect(() => {
    if (!user) return;
    listMinhasAtividades(createClient())
      .then(setAtividades)
      .catch(() => setErro("Não foi possível carregar suas atividades."))
      .finally(() => setLoading(false));
  }, [user]);

  const temas = useMemo(() => {
    const todas = atividades.flatMap(
      (a) => apresentacaoDa(a.escala)?.tags ?? []
    );
    return [...new Set(todas)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [atividades]);

  const contagem = useMemo(
    () => ({
      "para-voce": atividades.filter((a) => pertenceAba(a, "para-voce")).length,
      novidades: atividades.filter((a) => pertenceAba(a, "novidades")).length,
      concluidos: atividades.filter((a) => pertenceAba(a, "concluidos")).length,
    }),
    [atividades]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return atividades.filter((atividade) => {
      const info = apresentacaoDa(atividade.escala);
      if (!info) return false;
      if (!pertenceAba(atividade, tab)) return false;
      if (tema && !info.tags.includes(tema)) return false;
      if (!q) return true;
      return (
        info.title.toLowerCase().includes(q) ||
        info.description.toLowerCase().includes(q) ||
        info.instrumento.toLowerCase().includes(q) ||
        info.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [atividades, tab, tema, busca]);

  const concluidas = contagem.concluidos;

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

        {/* Só o que é verdade: quantas foram respondidas. Um contador de
            "dias seguidos" inventaria uma constância que ninguém mediu, e
            transformaria acompanhamento clínico em placar. */}
        {concluidas > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            {concluidas} {concluidas === 1 ? "respondida" : "respondidas"}
          </span>
        )}
      </header>

      {erro && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {erro}
        </div>
      )}

      {loading ? (
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando suas atividades...
        </p>
      ) : atividades.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 px-6 py-14 text-center dark:border-white/10">
          <Sparkles className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Nenhuma atividade por aqui ainda
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400 dark:text-zinc-500">
            Quando seu psicólogo enviar uma atividade para você, ela aparece
            nesta página — e você responde no seu ritmo.
          </p>
        </div>
      ) : (
        <>
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
                  ? "Você ainda não respondeu nenhuma atividade."
                  : "Nada pendente por aqui. Tudo em dia!"}
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visiveis.map((atividade) => (
                <PatientActivityCard
                  key={atividade.token}
                  atividade={atividade}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
