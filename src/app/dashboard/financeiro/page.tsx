"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  CheckCircle2,
  Clock3,
  PiggyBank,
  Plus,
  Trash2,
  TrendingDown,
  X,
  Sparkles,
  Loader2,
  Download,
  FileSignature,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { encerrarInscricao, inscreverComSeguranca } from "@/lib/supabase/realtime-seguro";
import { listPatients } from "@/lib/patients-client";
import {
  createLancamento,
  deleteLancamento,
  listLancamentos,
  rowToLancamento,
  updateLancamentoStatus,
  type Lancamento,
  type LancamentoRow,
  type TipoLancamento,
} from "@/lib/financeiro-client";
import type { Patient, PaymentStatus } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort, todayIso } from "@/lib/format";
import { ExportarLancamentosModal } from "@/components/dashboard/exportar-lancamentos-modal";

export default function FinanceiroPage() {
  const { user } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loadingLancamentos, setLoadingLancamentos] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    listPatients(supabase, user.id).then(setPatients);

    listLancamentos(supabase, user.id)
      .then(setLancamentos)
      .finally(() => setLoadingLancamentos(false));

    const channel = inscreverComSeguranca(() =>
      supabase
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
        .subscribe()
    );

    return () => encerrarInscricao(supabase, channel);
  }, [user]);

  const sortedLancamentos = [...lancamentos].sort((a, b) =>
    a.data < b.data ? 1 : a.data > b.data ? -1 : 0
  );

  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");

  const totalRecebido = receitas
    .filter((l) => l.status === "pago")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalAReceber = receitas
    .filter((l) => l.status === "pendente")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalDespesas = despesas
    .filter((l) => l.status === "pago")
    .reduce((sum, l) => sum + l.valor, 0);
  // Só receita paga menos despesa paga: pendente (dos dois lados) ainda não
  // é dinheiro de verdade no bolso, então não entra no saldo.
  const saldo = totalRecebido - totalDespesas;

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
    const quem =
      lancamento.patientName ?? lancamento.descricao ?? "lançamento sem descrição";
    const confirmed = window.confirm(
      `Excluir o lançamento de ${quem} (${formatCurrency(lancamento.valor)})? Essa ação não pode ser desfeita.`
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
            Acompanhe receitas, despesas e pendências do consultório. Clique
            no status de um lançamento para marcá-lo como pago ou pendente.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            A receber
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalAReceber)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <TrendingDown className="h-4 w-4 text-rose-500" />
            Despesas
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalDespesas)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <PiggyBank className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Saldo
          </div>
          <p
            className={`mt-2 whitespace-nowrap text-2xl font-bold ${
              saldo < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-900 dark:text-white"
            }`}
          >
            {formatCurrency(saldo)}
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
            const isDespesa = lancamento.tipo === "despesa";
            const isPago = lancamento.status === "pago";
            const isSaving = pendingIds.has(lancamento.id);
            const titulo = isDespesa
              ? lancamento.descricao || "Despesa"
              : lancamento.patientName;
            const subtitulo =
              isDespesa || !lancamento.descricao
                ? formatDateShort(lancamento.data)
                : `${formatDateShort(lancamento.data)} · ${lancamento.descricao}`;
            return (
              <div
                key={lancamento.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isDespesa
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
                      : "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"
                  }`}
                >
                  {isDespesa ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : (
                    <Wallet className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">
                    {titulo}
                  </p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {subtitulo}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-semibold ${
                    isDespesa
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-zinc-900 dark:text-white"
                  }`}
                >
                  {isDespesa ? "− " : ""}
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
                {!isDespesa && isPago && lancamento.patientId && (
                  <Link
                    href={`/dashboard/pacientes/${lancamento.patientId}?tab=documentos&recibo=${lancamento.id}`}
                    title="Emitir recibo"
                    aria-label="Emitir recibo"
                    className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                  >
                    <FileSignature className="h-4 w-4" />
                  </Link>
                )}
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

      {exportOpen && (
        <ExportarLancamentosModal
          lancamentos={lancamentos}
          onClose={() => setExportOpen(false)}
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
  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [patientId, setPatientId] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("pendente");
  const [data, setData] = useState(todayIso());
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textoIA, setTextoIA] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [avisoIA, setAvisoIA] = useState<string | null>(null);

  // "patients" chega via prop e pode terminar de carregar depois do modal já
  // aberto (fetch da página ainda em andamento) — derivar em vez de fixar o
  // primeiro id no useState evita que o <select> mostre um paciente que o
  // estado não sabe que está selecionado. Despesa não tem paciente por
  // padrão — diferente de receita, aqui não faz sentido "adivinhar" o
  // primeiro da lista, precisa ser escolha explícita.
  const selectedPatientId =
    tipo === "despesa" ? patientId : patientId || patients[0]?.id || "";

  function encontrarPaciente(nome: string) {
    const alvo = nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return patients.find((p) => {
      const candidato = p.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
      return candidato === alvo || candidato.includes(alvo) || alvo.includes(candidato);
    });
  }

  // Só pré-preenche os campos do formulário — quem confere e clica em
  // "Salvar lançamento" é sempre o psicólogo, nunca grava nada sozinho.
  async function handleExtrairComIA() {
    const texto = textoIA.trim();
    if (!texto || extraindo) return;
    setExtraindo(true);
    setError(null);
    setAvisoIA(null);
    try {
      const res = await fetch("/api/gemini/extrair-lancamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const result = await res.json();
      if (!res.ok) {
        const message = result?.error ?? "Não foi possível extrair o lançamento.";
        throw new Error(result?.detail ? `${message} (${result.detail})` : message);
      }

      const paciente = encontrarPaciente(result.paciente ?? "");
      if (paciente) {
        setPatientId(paciente.id);
      } else {
        setAvisoIA(
          `Não encontrei "${result.paciente}" na sua lista de pacientes — selecione manualmente.`
        );
      }
      if (typeof result.valor === "number" && Number.isFinite(result.valor)) {
        setValor(result.valor.toFixed(2).replace(".", ","));
      }
      if (typeof result.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(result.data)) {
        setData(result.data);
      }
      if (result.status === "pago" || result.status === "pendente") {
        setStatus(result.status);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível extrair o lançamento."
      );
    } finally {
      setExtraindo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (tipo === "receita" && !patient) {
      setError("Selecione um paciente.");
      return;
    }
    if (tipo === "despesa" && !descricao.trim()) {
      setError("Descreva a despesa (ex.: aluguel, material de escritório).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const valorNumerico = Number(valor.replace(",", "."));
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        setError("Informe um valor válido.");
        return;
      }
      const lancamento = await createLancamento(supabase, psicologoId, {
        tipo,
        patientId: patient?.id ?? null,
        patientName: patient?.name ?? null,
        valor: valorNumerico,
        status,
        data,
        descricao,
      });
      onCreated(lancamento);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o lançamento."
      );
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

        <div className="mt-4 inline-flex w-full rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {(["receita", "despesa"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tipo === t
                  ? t === "receita"
                    ? "bg-brand-600 text-white"
                    : "bg-rose-600 text-white"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {t === "receita" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        {tipo === "receita" && patients.length > 0 && (
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-3 dark:border-brand-900 dark:bg-brand-950">
            <label className="flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
              <Sparkles className="h-4 w-4" />
              Descrever com IA (opcional)
            </label>
            <p className="mt-1 text-xs text-brand-700/80 dark:text-brand-300/80">
              Cole ou digite, ex.: &quot;Recebi R$150 da Maria hoje&quot; — os
              campos abaixo são preenchidos automaticamente para você
              conferir e salvar.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={textoIA}
                onChange={(e) => setTextoIA(e.target.value)}
                placeholder="Recebi R$150 da Maria hoje, pago"
                disabled={extraindo}
                className="min-w-0 flex-1 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none disabled:opacity-60 dark:border-brand-800 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleExtrairComIA}
                disabled={extraindo || !textoIA.trim()}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extraindo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Extrair"
                )}
              </button>
            </div>
            {avisoIA && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {avisoIA}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {tipo === "receita" && patients.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Cadastre um paciente antes de registrar uma receita.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {(tipo === "despesa" || patients.length > 0) && (
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {tipo === "despesa" ? "Paciente (opcional)" : "Paciente"}
                <select
                  value={selectedPatientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required={tipo === "receita"}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {tipo === "despesa" && <option value="">— Sem paciente —</option>}
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Valor (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={valor}
                  onChange={(e) => {
                    // Aceita "150", "150,00" e "150.00" — input type="number"
                    // rejeita vírgula, o separador decimal usado no Brasil.
                    const next = e.target.value.replace(/[^0-9.,]/g, "");
                    setValor(next);
                  }}
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
                    {s === "pago"
                      ? tipo === "despesa"
                        ? "Pago"
                        : "Recebido"
                      : "Pendente"}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {tipo === "despesa" ? "Descrição" : "Descrição (opcional)"}
              <input
                type="text"
                required={tipo === "despesa"}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={
                  tipo === "despesa"
                    ? "Aluguel da sala, material de escritório..."
                    : "Sessão individual, pacote mensal..."
                }
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || (tipo === "receita" && patients.length === 0)}
          className="mt-6 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar lançamento"}
        </button>
      </form>
    </div>
  );
}
