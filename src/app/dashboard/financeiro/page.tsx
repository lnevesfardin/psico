"use client";

import { useMemo, useState } from "react";
import { Wallet, CheckCircle2, Clock3 } from "lucide-react";
import { useAppointments } from "@/context/appointments-context";
import type { Appointment } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort } from "@/lib/format";

export default function FinanceiroPage() {
  const { appointments, loading, updatePaymentStatus } = useAppointments();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const invoices = useMemo(
    () =>
      appointments
        .filter((a) => a.kind === "consulta" && a.status !== "desmarcada")
        .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)),
    [appointments]
  );

  const totalRecebido = invoices
    .filter((i) => i.paymentStatus === "pago")
    .reduce((sum, i) => sum + (i.valor ?? 0), 0);
  const totalPendente = invoices
    .filter((i) => i.paymentStatus === "pendente")
    .reduce((sum, i) => sum + (i.valor ?? 0), 0);

  async function handleToggle(invoice: Appointment) {
    const nextStatus = invoice.paymentStatus === "pago" ? "pendente" : "pago";
    setPendingIds((prev) => new Set(prev).add(invoice.id));
    try {
      await updatePaymentStatus(invoice.id, nextStatus);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(invoice.id);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Financeiro / Recibos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Acompanhe recebimentos e pendências do consultório. Clique no status
        de uma consulta para marcá-la como paga ou pendente.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Consultas
        </h2>
        <div className="mt-3 space-y-2">
          {loading && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Carregando...
            </p>
          )}

          {!loading && invoices.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Nenhuma consulta registrada ainda.
            </p>
          )}

          {invoices.map((invoice) => {
            const isPago = invoice.paymentStatus === "pago";
            const isSaving = pendingIds.has(invoice.id);
            return (
              <div
                key={invoice.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">
                    {invoice.patientName}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDateShort(invoice.date)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-zinc-900 dark:text-white">
                  {formatCurrency(invoice.valor ?? 0)}
                </p>
                <button
                  type="button"
                  onClick={() => handleToggle(invoice)}
                  disabled={isSaving}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isPago
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
                  }`}
                >
                  {isSaving ? "Salvando..." : isPago ? "Pago" : "Pendente"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
