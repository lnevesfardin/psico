import { Wallet, CheckCircle2, Clock3 } from "lucide-react";
import { invoices } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort } from "@/lib/format";

export default function FinanceiroPage() {
  const totalRecebido = invoices
    .filter((i) => i.status === "pago")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPendente = invoices
    .filter((i) => i.status === "pendente")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Financeiro / Recibos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Acompanhe recebimentos e pendências do consultório.
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
          Recibos recentes
        </h2>
        <div className="mt-3 space-y-2">
          {invoices.map((invoice) => (
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
                {formatCurrency(invoice.amount)}
              </p>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  invoice.status === "pago"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {invoice.status === "pago" ? "Pago" : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
