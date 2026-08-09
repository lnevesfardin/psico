"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Lancamento } from "@/lib/financeiro-client";
import { useAppointments } from "@/context/appointments-context";
import { formatCurrency, todayIso } from "@/lib/format";

function monthBounds(offset: number, hoje: string) {
  const [y, m] = hoje.split("-").map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  const inicio = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  const ultimoDia = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const fim = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim, ultimoDia };
}

export function DashboardFinanceiroTab({ lancamentos }: { lancamentos: Lancamento[] }) {
  const { appointments } = useAppointments();
  const hoje = todayIso();

  const stats = useMemo(() => {
    const { inicio: inicioMes, fim: fimMes, ultimoDia } = monthBounds(0, hoje);
    const { inicio: inicioMesAnterior, fim: fimMesAnterior } = monthBounds(-1, hoje);

    const noMes = (data: string) => data >= inicioMes && data <= fimMes;
    const noMesAnterior = (data: string) => data >= inicioMesAnterior && data <= fimMesAnterior;

    // "Faturamento" = o que de fato entrou (pago_em), não o que só venceu.
    const faturamentoMes = lancamentos
      .filter((l) => l.tipo === "receita" && l.status === "pago" && l.pagoEm && noMes(l.pagoEm))
      .reduce((sum, l) => sum + l.valor, 0);
    const faturamentoMesAnterior = lancamentos
      .filter((l) => l.tipo === "receita" && l.status === "pago" && l.pagoEm && noMesAnterior(l.pagoEm))
      .reduce((sum, l) => sum + l.valor, 0);
    const comparacao =
      faturamentoMesAnterior > 0
        ? ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
        : null;

    const sessoesPagasMes = lancamentos.filter(
      (l) => l.tipo === "receita" && l.categoria === "sessao" && l.status === "pago" && l.pagoEm && noMes(l.pagoEm)
    );
    const ticketMedio =
      sessoesPagasMes.length > 0
        ? sessoesPagasMes.reduce((sum, l) => sum + l.valor, 0) / sessoesPagasMes.length
        : 0;

    const consultasDoMes = appointments.filter((a) => a.kind === "consulta" && noMes(a.date));
    const realizadasOuConfirmadas = consultasDoMes.filter(
      (a) => a.status === "realizada" || a.status === "confirmada"
    ).length;
    // Aproximação: "ocupação" aqui é sobre o que foi agendado no mês (não
    // sobre a capacidade total de horários vagos em disponibilidades, que
    // exigiria cruzar com blocos de disponibilidade e feriados — fora de
    // escopo desta métrica).
    const taxaOcupacao =
      consultasDoMes.length > 0 ? (realizadasOuConfirmadas / consultasDoMes.length) * 100 : 0;
    const faltas = consultasDoMes.filter((a) => a.status === "falta").length;
    const taxaFalta = consultasDoMes.length > 0 ? (faltas / consultasDoMes.length) * 100 : 0;

    const porPaciente = new Map<string, { nome: string; total: number }>();
    for (const l of lancamentos) {
      if (l.tipo !== "receita" || l.status !== "pago" || !l.pagoEm || !noMes(l.pagoEm) || !l.patientId)
        continue;
      const atual = porPaciente.get(l.patientId) ?? { nome: l.patientName ?? "—", total: 0 };
      atual.total += l.valor;
      porPaciente.set(l.patientId, atual);
    }
    const topPacientes = [...porPaciente.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    const diaAtual = Number(hoje.split("-")[2]);
    const projecao = diaAtual > 0 ? (faturamentoMes / diaAtual) * ultimoDia : 0;

    return {
      faturamentoMes,
      comparacao,
      ticketMedio,
      taxaOcupacao,
      taxaFalta,
      topPacientes,
      projecao,
    };
  }, [lancamentos, appointments, hoje]);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Faturamento do mês</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(stats.faturamentoMes)}
          </p>
          {stats.comparacao != null && (
            <p
              className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${
                stats.comparacao >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {stats.comparacao > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : stats.comparacao < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {stats.comparacao.toFixed(1)}% vs. mês anterior
            </p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Projeção do mês corrente</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(stats.projecao)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
            Baseado no ritmo de faturamento até hoje.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ticket médio por sessão</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(stats.ticketMedio)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Ocupação da agenda / taxa de falta
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.taxaOcupacao.toFixed(0)}%
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
            {stats.taxaFalta.toFixed(0)}% de falta no mês
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Receita por paciente (top 10 do mês)
        </h3>
        <div className="mt-3 space-y-2">
          {stats.topPacientes.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Nenhum recebimento este mês ainda.
            </p>
          )}
          {stats.topPacientes.map((p, i) => (
            <div
              key={p.nome + i}
              className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-white">
                {p.nome}
              </p>
              <p className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-white">
                {formatCurrency(p.total)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
