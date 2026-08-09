"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  createObjetivo,
  createPlano,
  listObjetivos,
  listPlanos,
  updateObjetivoStatus,
  updatePlano,
  updatePlanoStatus,
  type Objetivo,
  type Plano,
  type PlanoInput,
  type PlanoStatus,
} from "@/lib/planos-terapeuticos-client";
import { formatDateShort } from "@/lib/format";

const STATUS_LABEL: Record<PlanoStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  pausado: "Pausado",
};

const PLANO_VAZIO: PlanoInput = {
  abordagem: "",
  hipoteseDiagnostica: "",
  objetivoGeral: "",
  revisarEm: null,
};

export function PatientPlanoTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [objetivosPorPlano, setObjetivosPorPlano] = useState<Record<string, Objetivo[]>>({});
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [form, setForm] = useState<PlanoInput>(PLANO_VAZIO);
  const [saving, setSaving] = useState(false);
  const [novoObjetivo, setNovoObjetivo] = useState("");
  const [novoIndicador, setNovoIndicador] = useState("");

  const planoAtivo = planos.find((p) => p.status === "ativo") ?? planos[0] ?? null;
  const objetivos = planoAtivo ? (objetivosPorPlano[planoAtivo.id] ?? []) : [];

  useEffect(() => {
    const supabase = createClient();
    listPlanos(supabase, patientId)
      .then(async (p) => {
        setPlanos(p);
        const entries = await Promise.all(
          p.map(async (plano) => [plano.id, await listObjetivos(supabase, plano.id)] as const)
        );
        setObjetivosPorPlano(Object.fromEntries(entries));
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  function abrirEdicao() {
    if (planoAtivo) {
      setForm({
        abordagem: planoAtivo.abordagem ?? "",
        hipoteseDiagnostica: planoAtivo.hipoteseDiagnostica ?? "",
        objetivoGeral: planoAtivo.objetivoGeral ?? "",
        revisarEm: planoAtivo.revisarEm,
      });
    } else {
      setForm(PLANO_VAZIO);
    }
    setEditando(true);
  }

  async function handleSalvarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      if (planoAtivo && !criandoNovo) {
        const atualizado = await updatePlano(supabase, planoAtivo.id, form);
        setPlanos((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
      } else {
        const criado = await createPlano(supabase, user.id, patientId, form);
        setPlanos((prev) => [criado, ...prev]);
        setObjetivosPorPlano((prev) => ({ ...prev, [criado.id]: [] }));
      }
      setEditando(false);
      setCriandoNovo(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusPlano(status: PlanoStatus) {
    if (!planoAtivo) return;
    const anterior = planoAtivo.status;
    setPlanos((prev) => prev.map((p) => (p.id === planoAtivo.id ? { ...p, status } : p)));
    try {
      const supabase = createClient();
      await updatePlanoStatus(supabase, planoAtivo.id, status);
    } catch {
      setPlanos((prev) => prev.map((p) => (p.id === planoAtivo.id ? { ...p, status: anterior } : p)));
    }
  }

  async function handleCriarObjetivo(e: React.FormEvent) {
    e.preventDefault();
    if (!planoAtivo || !novoObjetivo.trim()) return;
    const supabase = createClient();
    const objetivo = await createObjetivo(supabase, planoAtivo.id, {
      descricao: novoObjetivo.trim(),
      indicador: novoIndicador,
      ordem: objetivos.length,
    });
    setObjetivosPorPlano((prev) => ({
      ...prev,
      [planoAtivo.id]: [...(prev[planoAtivo.id] ?? []), objetivo],
    }));
    setNovoObjetivo("");
    setNovoIndicador("");
  }

  async function handleToggleObjetivo(objetivo: Objetivo) {
    if (!planoAtivo) return;
    const novoStatus = objetivo.status === "concluido" ? "em_andamento" : "concluido";
    setObjetivosPorPlano((prev) => ({
      ...prev,
      [planoAtivo.id]: prev[planoAtivo.id].map((o) =>
        o.id === objetivo.id ? { ...o, status: novoStatus } : o
      ),
    }));
    const supabase = createClient();
    await updateObjetivoStatus(supabase, objetivo.id, novoStatus);
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  if (editando) {
    return (
      <form onSubmit={handleSalvarPlano} className="mt-6 space-y-4 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Abordagem
          <input
            type="text"
            value={form.abordagem}
            onChange={(e) => setForm((f) => ({ ...f, abordagem: e.target.value }))}
            placeholder="Ex.: Terapia Cognitivo-Comportamental"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Queixa / hipótese diagnóstica
          <textarea
            value={form.hipoteseDiagnostica}
            onChange={(e) => setForm((f) => ({ ...f, hipoteseDiagnostica: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Objetivo geral
          <textarea
            value={form.objetivoGeral}
            onChange={(e) => setForm((f) => ({ ...f, objetivoGeral: e.target.value }))}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Data de revisão (opcional)
          <input
            type="date"
            value={form.revisarEm ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, revisarEm: e.target.value || null }))}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <span className="mt-1 block text-xs text-zinc-400 dark:text-zinc-600">
            Você recebe um aviso no painel quando essa data vencer.
          </span>
        </label>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setCriandoNovo(false);
            }}
            className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar plano"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {!planoAtivo ? (
        <button
          type="button"
          onClick={abrirEdicao}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Criar plano terapêutico
        </button>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <select
                    value={planoAtivo.status}
                    onChange={(e) => handleStatusPlano(e.target.value as PlanoStatus)}
                    className="rounded-full border-0 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 focus:outline-none dark:bg-brand-950 dark:text-brand-300"
                  >
                    {(Object.keys(STATUS_LABEL) as PlanoStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {planoAtivo.abordagem && (
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {planoAtivo.abordagem}
                    </span>
                  )}
                </div>
                {planoAtivo.revisarEm && (
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
                    Revisão prevista: {formatDateShort(planoAtivo.revisarEm)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={abrirEdicao}
                aria-label="Editar plano"
                className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            {planoAtivo.hipoteseDiagnostica && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                  Queixa / hipótese diagnóstica
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {planoAtivo.hipoteseDiagnostica}
                </p>
              </div>
            )}
            {planoAtivo.objetivoGeral && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                  Objetivo geral
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {planoAtivo.objetivoGeral}
                </p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Objetivos específicos
            </h3>
            <div className="mt-3 space-y-2">
              {objetivos.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Nenhum objetivo específico ainda.
                </p>
              )}
              {objetivos.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleObjetivo(o)}
                    aria-label={o.status === "concluido" ? "Marcar em andamento" : "Marcar concluído"}
                    className="mt-0.5 shrink-0"
                  >
                    {o.status === "concluido" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${o.status === "concluido" ? "text-zinc-400 line-through dark:text-zinc-600" : "text-zinc-900 dark:text-white"}`}
                    >
                      {o.descricao}
                    </p>
                    {o.indicador && (
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                        Indicador: {o.indicador}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCriarObjetivo} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={novoObjetivo}
                onChange={(e) => setNovoObjetivo(e.target.value)}
                placeholder="Novo objetivo específico"
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="text"
                value={novoIndicador}
                onChange={(e) => setNovoIndicador(e.target.value)}
                placeholder="Indicador de progresso (opcional)"
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={!novoObjetivo.trim()}
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Adicionar
              </button>
            </form>
          </div>

          {planoAtivo.status !== "ativo" && (
            <button
              type="button"
              onClick={() => {
                setForm(PLANO_VAZIO);
                setCriandoNovo(true);
                setEditando(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              Iniciar novo plano
            </button>
          )}
        </>
      )}
    </div>
  );
}
