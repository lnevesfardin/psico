"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, ListChecks, SmilePlus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/dashboard-data";
import { listMoodCheckins, MOOD_LABELS, type MoodCheckin } from "@/lib/mood-client";
import { listTarefasByPatient, type Tarefa } from "@/lib/tarefas-client";
import { listAplicacoesByPatient, type AplicacaoInstrumento } from "@/lib/instrumentos-client";
import { listObjetivosAbertosByPatient, type Objetivo } from "@/lib/planos-terapeuticos-client";
import { formatDateShort } from "@/lib/format";

export function PatientAntesDaSessaoTab({ patient }: { patient: Patient }) {
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [aplicacoes, setAplicacoes] = useState<AplicacaoInstrumento[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      patient.clienteUserId ? listMoodCheckins(supabase, patient.clienteUserId, 5) : Promise.resolve([]),
      listTarefasByPatient(supabase, patient.id),
      listAplicacoesByPatient(supabase, patient.id),
      listObjetivosAbertosByPatient(supabase, patient.id),
    ])
      .then(([c, t, a, o]) => {
        setCheckins(c);
        setTarefas(t);
        setAplicacoes(a);
        setObjetivos(o);
      })
      .finally(() => setLoading(false));
  }, [patient.id, patient.clienteUserId]);

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  const tarefasPendentes = tarefas
    .filter((t) => !t.concluidaEm)
    .sort((a, b) => (a.prazo ?? "9999") < (b.prazo ?? "9999") ? -1 : 1);
  const escalasRespondidas = aplicacoes.filter((a) => a.respondidoEm).slice(0, 5);
  const algumAlerta = checkins.some((c) => c.mood <= 2);

  return (
    <div className="mt-6 space-y-6">
      {algumAlerta && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-sm text-rose-800 dark:text-rose-200">
            Humor baixo registrado recentemente — vale conferir antes da sessão.
          </p>
        </div>
      )}

      <Secao icon={SmilePlus} titulo="Humor recente">
        {!patient.clienteUserId ? (
          <VazioTexto texto="Paciente ainda não tem conta própria para registrar humor." />
        ) : checkins.length === 0 ? (
          <VazioTexto texto="Nenhum check-in registrado ainda." />
        ) : (
          <ul className="space-y-1.5">
            {checkins.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50"
              >
                <span className="text-zinc-700 dark:text-zinc-300">{formatDateShort(c.date)}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {MOOD_LABELS[c.mood]} · Energia {c.energy}/5
                  {c.anxiety ? ` · Ansiedade ${c.anxiety}/5` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={ListChecks} titulo="Tarefas pendentes">
        {tarefasPendentes.length === 0 ? (
          <VazioTexto texto="Nenhuma tarefa pendente." />
        ) : (
          <ul className="space-y-1.5">
            {tarefasPendentes.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50"
              >
                <span className="text-zinc-700 dark:text-zinc-300">{t.titulo}</span>
                {t.prazo && (
                  <span className="text-zinc-400 dark:text-zinc-600">{formatDateShort(t.prazo)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={ClipboardCheck} titulo="Escalas respondidas recentemente">
        {escalasRespondidas.length === 0 ? (
          <VazioTexto texto="Nenhuma escala respondida ainda." />
        ) : (
          <ul className="space-y-1.5">
            {escalasRespondidas.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  {a.instrumentoSigla} · {formatDateShort(a.respondidoEm!)}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {a.escore} ({a.faixa})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={Target} titulo="Objetivos em aberto">
        {objetivos.length === 0 ? (
          <VazioTexto texto="Nenhum objetivo em aberto." />
        ) : (
          <ul className="space-y-1.5">
            {objetivos.map((o) => (
              <li key={o.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50">
                <p className="text-zinc-700 dark:text-zinc-300">{o.descricao}</p>
                {o.indicador && (
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                    Indicador: {o.indicador}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

function Secao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <Icon className="h-4 w-4" />
        {titulo}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function VazioTexto({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
      {texto}
    </p>
  );
}
