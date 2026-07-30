"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  CheckCircle2,
  Clock3,
  PiggyBank,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listPatients } from "@/lib/patients-client";
import {
  createLancamento,
  deleteLancamento,
  listLancamentos,
  rowToLancamento,
  updateLancamentoStatus,
  type Lancamento,
  type LancamentoRow,
} from "@/lib/financeiro-client";
import type { Patient, PaymentStatus } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort, todayIso } from "@/lib/format";

export default function FinanceiroPage() {
  const { user } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loadingLancamentos, setLoadingLancamentos] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    listPatients(supabase, user.id).then(setPatients);

    listLancamentos(supabase, user.id)
      .then(setLancamentos)
      .finally(() => setLoadingLancamentos(false));

    const channel = supabase
      .channel(`lancamentos-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lancamentos_financeiros",
          filter: `psicologo_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            setLancamentos((prev) => prev.filter((l) => l.id !== oldId));
            return;
          }
          const lancamento = rowToLancamento(payload.new as LancamentoRow);
          setLancamentos((prev) => {
            const exists = prev.some((l) => l.id === lancamento.id);
            return exists
              ? prev.map((l) => (l.id === lancamento.id ? lancamento : l))
              : [lancamento, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const sortedLancamentos = [...lancamentos].sort((a, b) =>
    a.data < b.data ? 1 : a.data > b.data ? -1 : 0
  );

  const totalRecebido = lancamentos
    .filter((l) => l.status === "pago")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalPendente = lancamentos
    .filter((l) => l.status === "pendente")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalGeral = totalRecebido + totalPendente;

  async function handleToggle(lancamento: Lancamento) {
    const nextStatus: PaymentStatus =
      lancamento.status === "pago" ? "pendente" : "pago";
    setPendingIds((prev) => new Set(prev).add(lancamento.id));
    try {
      const supabase = createClient();
      await updateLancamentoStatus(supabase, lancamento.id, nextStatus);
      setLancamentos((prev) =>
        prev.map((l) =>
          l.id === lancamento.id ? { ...l, status: nextStatus } : l
        )
      );
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(lancamento.id);
        return next;
      });
    }
  }

  function handleCreated(lancamento: Lancamento) {
    setLancamentos((prev) => [lancamento, ...prev]);
    setModalOpen(false);
  }

  async function handleDelete(lancamento: Lancamento) {
    const confirmed = window.confirm(
      `Excluir o lançamento de ${lancamento.patientName} (${formatCurrency(lancamento.valor)})? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    setPendingIds((prev) => new Set(prev).add(lancamento.id));
    try {
      const supabase = createClient();
      await deleteLancamento(supabase, lancamento.id);
      setLancamentos((prev) => prev.filter((l) => l.id !== lancamento.id));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(lancamento.id);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Financeiro / Recibos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Acompanhe recebimentos e pendências do consultório. Clique no
            status de um lançamento para marcá-lo como pago ou pendente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Recebido
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalRecebido)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <Clock3 className="h-4 w-4 text-amber-500" />
            Pendente
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalPendente)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <PiggyBank className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Faturamento total
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalGeral)}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Lançamentos
        </h2>
        <div className="mt-3 space-y-2">
          {loadingLancamentos && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Carregando...
            </p>
          )}

          {!loadingLancamentos && sortedLancamentos.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Nenhum lançamento registrado ainda. Use o botão &quot;Novo
              Lançamento&quot; para começar.
            </p>
          )}

          {sortedLancamentos.map((lancamento) => {
            const isPago = lancamento.status === "pago";
            const isSaving = pendingIds.has(lancamento.id);
            return (
              <div
                key={lancamento.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">
                    {lancamento.patientName}
                  </p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDateShort(lancamento.data)}
                    {lancamento.descricao ? ` · ${lancamento.descricao}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-zinc-900 dark:text-white">
                  {formatCurrency(lancamento.valor)}
                </p>
                <button
                  type="button"
                  onClick={() => handleToggle(lancamento)}
                  disabled={isSaving}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isPago
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
                  }`}
                >
                  {isSaving ? "Salvando..." : isPago ? "Pago" : "Pendente"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(lancamento)}
                  disabled={isSaving}
                  aria-label="Excluir lançamento"
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && user && (
        <NewLancamentoModal
          psicologoId={user.id}
          patients={patients}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function NewLancamentoModal({
  psicologoId,
  patients,
  onClose,
  onCreated,
}: {
  psicologoId: string;
  patients: Patient[];
  onClose: () => void;
  onCreated: (lancamento: Lancamento) => void;
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("pendente");
  const [data, setData] = useState(todayIso());
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      setError("Selecione um paciente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const lancamento = await createLancamento(supabase, psicologoId, {
        patientId: patient.id,
        patientName: patient.name,
        valor: Number(valor),
        status,
        data,
        descricao,
      });
      onCreated(lancamento);
    } catch {
      setError("Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Novo Lançamento
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {patients.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Cadastre um paciente antes de registrar um lançamento.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Paciente
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Valor (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="150,00"
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Data
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
            </div>

            <div>
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Status do pagamento
              </span>
              <div className="mt-1.5 inline-flex w-full rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                {(["pago", "pendente"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      status === s
                        ? "bg-brand-600 text-white"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {s === "pago" ? "Recebido" : "Pendente"}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Descrição (opcional)
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Sessão individual, pacote mensal..."
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || patients.length === 0}
          className="mt-6 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar lançamento"}
        </button>
      </form>
    </div>
  );
}
