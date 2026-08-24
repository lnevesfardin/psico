"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarX2,
  CheckCircle2,
  Clock3,
  Loader2,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useAppointments } from "@/context/appointments-context";
import { listPatients } from "@/lib/patients-client";
import { listLancamentos, type Lancamento } from "@/lib/financeiro-client";
import { formatCurrency, isoNoFusoBr, todayIso } from "@/lib/format";
import type { Appointment, AppointmentStatus, Patient } from "@/lib/dashboard-data";

type Periodo = "mes" | "3meses" | "ano";

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "mes", label: "Este mês" },
  { id: "3meses", label: "Últimos 3 meses" },
  { id: "ano", label: "Este ano" },
];

/** Início do período (inclusive) — o fim é sempre hoje. */
function inicioPeriodo(periodo: Periodo, hoje: string): string {
  const [ano, mes] = hoje.split("-").map(Number);
  if (periodo === "ano") return `${ano}-01-01`;
  if (periodo === "mes") return `${hoje.slice(0, 7)}-01`;
  // 3meses: mês atual + os 2 anteriores.
  const d = new Date(ano, mes - 1 - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Últimos `n` meses (mais antigo primeiro), como chave "yyyy-mm" + rótulo curto. */
function ultimosMeses(hoje: string, n: number): { chave: string; label: string }[] {
  const [ano, mes] = hoje.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const offset = n - 1 - i;
    const d = new Date(ano, mes - 1 - offset, 1);
    return {
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  });
}

const STATUS_META: Record<AppointmentStatus, { label: string; cor: string }> = {
  realizada: { label: "Realizada", cor: "bg-emerald-500" },
  confirmada: { label: "Confirmada", cor: "bg-brand-500" },
  pendente: { label: "Pendente", cor: "bg-amber-500" },
  desmarcada: { label: "Desmarcada", cor: "bg-rose-400" },
};

export default function RelatoriosPage() {
  const { user } = useAuth();
  const { appointments, loading: carregandoAgenda } = useAppointments();

  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      listPatients(supabase, user.id),
      listLancamentos(supabase, user.id),
    ])
      .then(([p, l]) => {
        setPacientes(p);
        setLancamentos(l);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [user]);

  const hoje = todayIso();
  const inicio = useMemo(() => inicioPeriodo(periodo, hoje), [periodo, hoje]);

  const consultasPeriodo = useMemo(
    () =>
      appointments.filter(
        (a): a is Appointment =>
          a.kind !== "bloqueio" && a.date >= inicio && a.date <= hoje
      ),
    [appointments, inicio, hoje]
  );

  const porStatus = useMemo(() => {
    const contagem: Record<AppointmentStatus, number> = {
      pendente: 0,
      confirmada: 0,
      realizada: 0,
      desmarcada: 0,
    };
    for (const a of consultasPeriodo) contagem[a.status] += 1;
    return contagem;
  }, [consultasPeriodo]);

  const taxaDesmarcada =
    consultasPeriodo.length > 0
      ? porStatus.desmarcada / consultasPeriodo.length
      : 0;

  // Só receita: despesa (aluguel, material...) não é faturamento — contar as
  // duas juntas inflaria "recebido"/"a receber" com dinheiro que na verdade
  // saiu, não entrou.
  const lancamentosPeriodo = useMemo(
    () =>
      lancamentos.filter(
        (l) => l.tipo === "receita" && l.data >= inicio && l.data <= hoje
      ),
    [lancamentos, inicio, hoje]
  );
  const recebido = lancamentosPeriodo
    .filter((l) => l.status === "pago")
    .reduce((soma, l) => soma + l.valor, 0);
  const aReceber = lancamentosPeriodo
    .filter((l) => l.status !== "pago")
    .reduce((soma, l) => soma + l.valor, 0);

  const novasFichas = useMemo(
    () =>
      pacientes.filter((p) => {
        // createdAt é timestamptz (UTC); .slice(0,10) cru pegaria o dia em
        // UTC, que diverge do dia local do Brasil à noite — precisa
        // converter pro fuso antes de comparar com inicio/hoje.
        const dataLocal = isoNoFusoBr(new Date(p.createdAt));
        return dataLocal >= inicio && dataLocal <= hoje;
      }),
    [pacientes, inicio, hoje]
  );

  // Independe do seletor de período: sempre a tendência dos últimos 6 meses,
  // pra dar noção de trajetória mesmo quando o período escolhido acima é curto.
  const faturamentoMensal = useMemo(() => {
    const meses = ultimosMeses(hoje, 6);
    return meses.map(({ chave, label }) => ({
      label,
      total: lancamentos
        .filter(
          (l) =>
            l.tipo === "receita" && l.status === "pago" && l.data.startsWith(chave)
        )
        .reduce((soma, l) => soma + l.valor, 0),
    }));
  }, [lancamentos, hoje]);
  const maxMensal = Math.max(...faturamentoMensal.map((m) => m.total), 1);

  const ocupado = carregandoAgenda || carregando;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Relatórios
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Faturamento, presença e novas fichas do consultório.
          </p>
        </div>

        <div className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {PERIODOS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodo(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                periodo === id
                  ? "bg-brand-600 text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {ocupado ? (
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando relatórios...
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Recebido
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {formatCurrency(recebido)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Clock3 className="h-4 w-4 text-amber-500" />
                A receber
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {formatCurrency(aReceber)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <CalendarX2 className="h-4 w-4 text-rose-500" />
                Desmarcadas
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {Math.round(taxaDesmarcada * 100)}%
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                {porStatus.desmarcada} de {consultasPeriodo.length}{" "}
                {consultasPeriodo.length === 1 ? "consulta" : "consultas"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <UserPlus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                Novas fichas
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {novasFichas.length}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Faturamento recebido nos últimos 6 meses
              </h2>
              <div className="mt-6 flex h-32 items-end gap-3">
                {faturamentoMensal.map(({ label, total }) => (
                  <div
                    key={label}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    {/* Zona de altura fixa: altura em "%" só resolve contra um
                        pai com altura definida, e o wrapper flex-col acima
                        (que também abriga o rótulo do mês) tem altura
                        automática — sem essa div intermediária a barra fica
                        invisível (altura vira 0). */}
                    <div
                      title={formatCurrency(total)}
                      className="flex h-24 w-full items-end"
                    >
                      <div
                        className="w-full rounded-t-md bg-brand-500 transition-all dark:bg-brand-400"
                        style={{
                          height: `${Math.max((total / maxMensal) * 100, total > 0 ? 4 : 1)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-medium capitalize text-zinc-400 dark:text-zinc-600">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Consultas por status no período
              </h2>
              {consultasPeriodo.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Nenhuma consulta nesse período.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {(Object.keys(STATUS_META) as AppointmentStatus[]).map((status) => {
                    const qtd = porStatus[status];
                    const pct = consultasPeriodo.length
                      ? (qtd / consultasPeriodo.length) * 100
                      : 0;
                    return (
                      <li key={status}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                            <span
                              className={`h-2 w-2 rounded-full ${STATUS_META[status].cor}`}
                            />
                            {STATUS_META[status].label}
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {qtd}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={`h-full rounded-full ${STATUS_META[status].cor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
