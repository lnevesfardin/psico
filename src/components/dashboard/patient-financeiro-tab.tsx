"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listLancamentosByPatient, type Lancamento } from "@/lib/financeiro-client";
import type { PaymentStatus } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort } from "@/lib/format";

const STATUS_CLASS: Record<PaymentStatus, string> = {
  pago: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  pendente: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancelado: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pago: "Pago",
  pendente: "Pendente",
  cancelado: "Cancelado",
};

// Só leitura: lançar/editar continua sendo feito na tela Financeiro
// principal — aqui é só o histórico deste paciente.
export function PatientFinanceiroTab({ patientId }: { patientId: string }) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    listLancamentosByPatient(supabase, patientId)
      .then(setLancamentos)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        Carregando...
      </p>
    );
  }

  if (lancamentos.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Nenhum lançamento financeiro para este paciente ainda.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      {lancamentos.map((l) => (
        <div
          key={l.id}
          className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Wallet className="h-4 w-4 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {formatCurrency(l.valor)}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {formatDateShort(l.data)}
              {l.descricao ? ` · ${l.descricao}` : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[l.status]}`}
          >
            {STATUS_LABEL[l.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
