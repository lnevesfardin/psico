"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  CheckCircle2,
  Clock3,
  PiggyBank,
  Plus,
  Trash2,
  X,
  Sparkles,
  Loader2,
  Download,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useProfile } from "@/context/profile-context";
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
import type {
  CategoriaLancamento,
  FormaPagamento,
  Patient,
  PaymentStatus,
  TipoLancamento,
} from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort, todayIso } from "@/lib/format";
import { AReceberTab } from "@/components/dashboard/financeiro-a-receber-tab";
import { DashboardFinanceiroTab } from "@/components/dashboard/financeiro-dashboard-tab";
import { RecibosTab } from "@/components/dashboard/financeiro-recibos-tab";

const CATEGORIA_LABEL: Record<CategoriaLancamento, string> = {
  sessao: "Sessão",
  pacote: "Pacote",
  aluguel: "Aluguel",
  supervisao: "Supervisão",
  software: "Software",
  imposto: "Imposto",
  outro: "Outro",
};

const CATEGORIAS_RECEITA: CategoriaLancamento[] = ["sessao", "pacote", "outro"];
const CATEGORIAS_DESPESA: CategoriaLancamento[] = [
  "aluguel",
  "supervisao",
  "software",
  "imposto",
  "outro",
];

type StatusFilter = "todos" | PaymentStatus;
type TipoFilter = "todos" | TipoLancamento;

export default function FinanceiroPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"lancamentos" | "a_receber" | "dashboard" | "recibos">(
    "lancamentos"
  );

  const [patients, setPatients] = useState<Patient[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loadingLancamentos, setLoadingLancamentos] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [patientFilter, setPatientFilter] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaLancamento | "todas">("todas");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");

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

  const filtered = useMemo(() => {
    return lancamentos
      .filter((l) => !periodoInicio || l.vencimento >= periodoInicio)
      .filter((l) => !periodoFim || l.vencimento <= periodoFim)
      .filter((l) => statusFilter === "todos" || l.status === statusFilter)
      .filter((l) => !patientFilter || l.patientId === patientFilter)
      .filter((l) => categoriaFilter === "todas" || l.categoria === categoriaFilter)
      .filter((l) => tipoFilter === "todos" || l.tipo === tipoFilter)
      .sort((a, b) => (a.vencimento < b.vencimento ? 1 : a.vencimento > b.vencimento ? -1 : 0));
  }, [lancamentos, periodoInicio, periodoFim, statusFilter, patientFilter, categoriaFilter, tipoFilter]);

  const totalRecebido = filtered
    .filter((l) => l.tipo === "receita" && l.status === "pago")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalPendente = filtered
    .filter((l) => l.tipo === "receita" && l.status === "pendente")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalDespesas = filtered
    .filter((l) => l.tipo === "despesa" && l.status !== "cancelado")
    .reduce((sum, l) => sum + l.valor, 0);
  const totalGeral = totalRecebido - totalDespesas;

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
    const label = lancamento.tipo === "despesa" ? "a despesa" : "o lançamento";
    const confirmed = window.confirm(
      `Excluir ${label} de ${lancamento.patientName ?? lancamento.descricao ?? "—"} (${formatCurrency(lancamento.valor)})? Essa ação não pode ser desfeita.`
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

  function handleExportCsv() {
    const header = ["Data", "Vencimento", "Tipo", "Categoria", "Paciente", "Valor", "Status", "Descrição"];
    const rows = filtered.map((l) => [
      l.data,
      l.vencimento,
      l.tipo,
      CATEGORIA_LABEL[l.categoria],
      l.patientName ?? "",
      l.valor.toFixed(2).replace(".", ","),
      l.status,
      (l.descricao ?? "").replace(/[\r\n;]+/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // BOM: Excel no Windows (o que o contador provavelmente usa) só detecta
    // UTF-8 sem isso mostrar "Recebido"/"Descrição" com acento quebrado.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${periodoInicio || "todos"}_${periodoFim || todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Financeiro / Recibos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Acompanhe recebimentos, despesas e pendências do consultório.
          </p>
        </div>
        {tab === "lancamentos" && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </button>
        )}
      </div>

      <div className="mt-6 inline-flex flex-wrap rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {(["lancamentos", "a_receber", "dashboard", "recibos"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-brand-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {t === "lancamentos"
              ? "Lançamentos"
              : t === "a_receber"
                ? "A Receber"
                : t === "dashboard"
                  ? "Dashboard"
                  : "Recibos"}
          </button>
        ))}
      </div>

      {tab === "lancamentos" && (
        <>
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
                <TrendingDown className="h-4 w-4 text-rose-500" />
                Despesas
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {formatCurrency(totalDespesas)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <PiggyBank className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="text-zinc-600 dark:text-zinc-400">Faturamento líquido (recebido − despesas):</span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {formatCurrency(totalGeral)}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <span className="text-sm text-zinc-400">até</span>
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as TipoFilter)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="todos">Receita e despesa</option>
              <option value="receita">Só receita</option>
              <option value="despesa">Só despesa</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="todos">Todos os status</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="">Todos os pacientes</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value as CategoriaLancamento | "todas")}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="todas">Todas as categorias</option>
              {Object.entries(CATEGORIA_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>

          <div className="mt-6">
            <div className="space-y-2">
              {loadingLancamentos && (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Carregando...
                </p>
              )}

              {!loadingLancamentos && filtered.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Nenhum lançamento encontrado para esse filtro.
                </p>
              )}

              {filtered.map((lancamento) => {
                const isPago = lancamento.status === "pago";
                const isDespesa = lancamento.tipo === "despesa";
                const isSaving = pendingIds.has(lancamento.id);
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
                      {isDespesa ? <TrendingDown className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-white">
                        {lancamento.patientName ?? CATEGORIA_LABEL[lancamento.categoria]}
                      </p>
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {formatDateShort(lancamento.vencimento)} · {CATEGORIA_LABEL[lancamento.categoria]}
                        {lancamento.descricao ? ` · ${lancamento.descricao}` : ""}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 font-semibold ${isDespesa ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"}`}
                    >
                      {isDespesa ? "− " : ""}
                      {formatCurrency(lancamento.valor)}
                    </p>
                    {lancamento.status !== "cancelado" && (
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
        </>
      )}

      {tab === "a_receber" && <AReceberTab lancamentos={lancamentos} />}
      {tab === "dashboard" && <DashboardFinanceiroTab lancamentos={lancamentos} />}
      {tab === "recibos" && <RecibosTab patients={patients} />}

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
  const { profile } = useProfile();
  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [patientId, setPatientId] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState<CategoriaLancamento>("sessao");
  const [status, setStatus] = useState<PaymentStatus>("pendente");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "">("");
  const [data, setData] = useState(todayIso());
  const [vencimento, setVencimento] = useState(todayIso());
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textoIA, setTextoIA] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [avisoIA, setAvisoIA] = useState<string | null>(null);

  // "patients" chega via prop e pode terminar de carregar depois do modal já
  // aberto (fetch da página ainda em andamento) — derivar em vez de fixar o
  // primeiro id no useState evita que o <select> mostre um paciente que o
  // estado não sabe que está selecionado.
  const selectedPatientId = patientId || patients[0]?.id || "";

  function handlePatientChange(id: string) {
    setPatientId(id);
    // Pré-preenche o valor com o valor de sessão do paciente (ou o valor
    // padrão do psicólogo) só se o campo ainda não foi digitado à mão —
    // nunca sobrescreve o que o psicólogo já escreveu.
    if (!valor) {
      const patient = patients.find((p) => p.id === id);
      const sugerido = patient?.valorSessao ?? profile.price ?? null;
      if (sugerido) setValor(sugerido.toFixed(2).replace(".", ","));
    }
  }

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
        setVencimento(result.data);
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
    const patient = tipo === "receita" ? patients.find((p) => p.id === selectedPatientId) : null;
    if (tipo === "receita" && !patient) {
      setError("Selecione um paciente.");
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
        categoria,
        data,
        vencimento,
        formaPagamento: status === "pago" && formaPagamento ? formaPagamento : null,
        agendamentoId: null,
        pacoteId: null,
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

  const categorias = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
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
              onClick={() => {
                setTipo(t);
                setCategoria(t === "receita" ? "sessao" : "aluguel");
              }}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tipo === t ? "bg-brand-600 text-white" : "text-zinc-600 dark:text-zinc-400"
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
            {tipo === "receita" && (
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Paciente
                <select
                  value={selectedPatientId}
                  onChange={(e) => handlePatientChange(e.target.value)}
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
                Categoria
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as CategoriaLancamento)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Vencimento
                <input
                  type="date"
                  required
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
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
                    {s === "pago" ? (tipo === "receita" ? "Recebido" : "Pago") : "Pendente"}
                  </button>
                ))}
              </div>
            </div>

            {status === "pago" && (
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Forma de pagamento (opcional)
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento | "")}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">—</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </label>
            )}

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Descrição (opcional)
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={tipo === "receita" ? "Sessão individual, pacote mensal..." : "Aluguel de agosto..."}
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
