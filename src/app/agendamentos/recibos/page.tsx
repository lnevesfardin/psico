"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listMeusRecibos } from "@/lib/recibos-client";
import type { Recibo } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort } from "@/lib/format";

export default function MeusRecibosPage() {
  const { user } = useAuth();
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listMeusRecibos(supabase)
      .then(setRecibos)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meus Recibos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Recibos emitidos pelo seu psicólogo, com a situação de pagamento.
      </p>

      {loading && (
        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Carregando...
        </p>
      )}

      {!loading && recibos.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
          Nenhum recibo emitido ainda.
        </p>
      )}

      <div className="mt-6 space-y-2">
        {recibos.map((r) => (
          <Link
            key={r.id}
            href={`/agendamentos/recibos/${r.id}`}
            className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-white">
                Recibo nº {r.numero}
              </p>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {formatDateShort(r.competenciaInicio)} a {formatDateShort(r.competenciaFim)} ·{" "}
                {r.quantidadeSessoes} sessão(ões)
              </p>
            </div>
            <p className="shrink-0 font-semibold text-zinc-900 dark:text-white">
              {formatCurrency(r.valorTotal)}
            </p>
            <Printer className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
          </Link>
        ))}
      </div>
    </main>
  );
}
