"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { createTarefa, deleteTarefa, listTarefasByPatient, type Tarefa } from "@/lib/tarefas-client";
import { listObjetivosAbertosByPatient, type Objetivo } from "@/lib/planos-terapeuticos-client";
import { formatDateShort } from "@/lib/format";

export function PatientTarefasTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [prazo, setPrazo] = useState("");
  const [objetivoId, setObjetivoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      listTarefasByPatient(supabase, patientId),
      listObjetivosAbertosByPatient(supabase, patientId),
    ])
      .then(([t, o]) => {
        setTarefas(t);
        setObjetivos(o);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !titulo.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const tarefa = await createTarefa(supabase, user.id, {
        patientId,
        objetivoId: objetivoId || null,
        titulo: titulo.trim(),
        instrucoes,
        prazo: prazo || null,
      });
      setTarefas((prev) => [tarefa, ...prev]);
      setTitulo("");
      setInstrucoes("");
      setPrazo("");
      setObjetivoId("");
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Apagar esta tarefa? Não pode ser desfeito.");
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      await deleteTarefa(supabase, id);
      setTarefas((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  return (
    <div className="mt-6">
      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Título
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Praticar respiração diafragmática"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Instruções (opcional)
            <textarea
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Prazo (opcional)
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          {objetivos.length > 0 && (
            <label className="mt-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Vincular a um objetivo do plano (opcional)
              <select
                value={objetivoId}
                onChange={(e) => setObjetivoId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Nenhum</option>
                {objetivos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.descricao}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Enviar tarefa"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {tarefas.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            Nenhuma tarefa enviada ainda.
          </p>
        )}
        {tarefas.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
                  {t.concluidaEm && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                  {t.titulo}
                </p>
                {t.instrucoes && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t.instrucoes}</p>
                )}
                {t.prazo && (
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                    Prazo: {formatDateShort(t.prazo)}
                  </p>
                )}
                {t.objetivoId && (
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                    Objetivo: {objetivos.find((o) => o.id === t.objetivoId)?.descricao ?? "—"}
                  </p>
                )}
                {t.respostaPaciente && (
                  <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300">
                    Resposta: {t.respostaPaciente}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={deletingId === t.id}
                aria-label="Apagar tarefa"
                className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
