"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listMinhasTarefas, responderTarefa, type Tarefa } from "@/lib/tarefas-client";
import { formatDateShort } from "@/lib/format";

export default function MinhasTarefasPage() {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listMinhasTarefas(supabase)
      .then((lista) => {
        setTarefas(lista);
        setRespostas(
          Object.fromEntries(lista.map((t) => [t.id, t.respostaPaciente ?? ""]))
        );
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSalvar(tarefa: Tarefa, concluida: boolean) {
    setSavingId(tarefa.id);
    try {
      const supabase = createClient();
      const resposta = respostas[tarefa.id] ?? "";
      await responderTarefa(supabase, tarefa.id, { respostaPaciente: resposta, concluida });
      setTarefas((prev) =>
        prev.map((t) =>
          t.id === tarefa.id
            ? { ...t, respostaPaciente: resposta, concluidaEm: concluida ? new Date().toISOString() : null }
            : t
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  const pendentes = tarefas.filter((t) => !t.concluidaEm);
  const concluidas = tarefas.filter((t) => t.concluidaEm);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Minhas Tarefas
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Tarefas e orientações enviadas pelo seu psicólogo.
      </p>

      {loading && (
        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Carregando...
        </p>
      )}

      {!loading && tarefas.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nenhuma tarefa por aqui ainda.
          </p>
        </div>
      )}

      {pendentes.length > 0 && (
        <div className="mt-6 space-y-3">
          {pendentes.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t.titulo}</p>
                  {t.instrucoes && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                      {t.instrucoes}
                    </p>
                  )}
                  {t.prazo && (
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                      Prazo: {formatDateShort(t.prazo)}
                    </p>
                  )}
                </div>
              </div>
              <textarea
                value={respostas[t.id] ?? ""}
                onChange={(e) => setRespostas((prev) => ({ ...prev, [t.id]: e.target.value }))}
                rows={2}
                placeholder="Escreva sua resposta (opcional)..."
                className="mt-3 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSalvar(t, false)}
                  disabled={savingId === t.id}
                  className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Salvar resposta
                </button>
                <button
                  type="button"
                  onClick={() => handleSalvar(t, true)}
                  disabled={savingId === t.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Marcar como concluída
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {concluidas.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Concluídas</h2>
          <div className="mt-3 space-y-2">
            {concluidas.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white">{t.titulo}</p>
                  {t.respostaPaciente && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                      {t.respostaPaciente}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                    Concluída em {t.concluidaEm ? formatDateShort(t.concluidaEm.slice(0, 10)) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
