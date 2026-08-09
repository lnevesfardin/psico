"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Lancamento } from "@/lib/financeiro-client";
import { formatCurrency, todayIso } from "@/lib/format";

function diasAtraso(vencimento: string, hoje: string): number {
  const v = new Date(vencimento + "T00:00:00");
  const h = new Date(hoje + "T00:00:00");
  return Math.round((h.getTime() - v.getTime()) / (1000 * 60 * 60 * 24));
}

export function AReceberTab({ lancamentos }: { lancamentos: Lancamento[] }) {
  const hoje = todayIso();

  const porPaciente = useMemo(() => {
    const atrasados = lancamentos.filter(
      (l) => l.tipo === "receita" && l.status === "pendente" && l.vencimento < hoje && l.patientId
    );
    const grupos = new Map<
      string,
      { patientId: string; patientName: string; total: number; maisAntigo: string; count: number }
    >();
    for (const l of atrasados) {
      const g = grupos.get(l.patientId!) ?? {
        patientId: l.patientId!,
        patientName: l.patientName ?? "—",
        total: 0,
        maisAntigo: l.vencimento,
        count: 0,
      };
      g.total += l.valor;
      g.count += 1;
      if (l.vencimento < g.maisAntigo) g.maisAntigo = l.vencimento;
      grupos.set(l.patientId!, g);
    }
    return [...grupos.values()].sort((a, b) => b.total - a.total);
  }, [lancamentos, hoje]);

  const totalGeral = porPaciente.reduce((sum, g) => sum + g.total, 0);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {porPaciente.length === 0
          ? "Nenhum paciente em atraso."
          : `${formatCurrency(totalGeral)} em atraso, de ${porPaciente.length} paciente(s).`}
      </div>

      <div className="mt-4 space-y-2">
        {porPaciente.map((g) => (
          <div
            key={g.patientId}
            className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-white">{g.patientName}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {g.count} lançamento(s) · {diasAtraso(g.maisAntigo, hoje)} dia(s) de atraso (mais antigo)
              </p>
            </div>
            <p className="shrink-0 font-semibold text-rose-600 dark:text-rose-400">
              {formatCurrency(g.total)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
