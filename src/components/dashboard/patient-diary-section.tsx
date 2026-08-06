"use client";

import { useEffect, useState } from "react";
import { BookLock, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listDiario, type EntradaDiario } from "@/lib/diario-client";
import { formatDateTime } from "@/lib/format";

/**
 * Só entradas que o paciente marcou como compartilhadas. O filtro real está
 * na RLS (psicologo_le_diario_compartilhado), não aqui: anotação privada não
 * chega nem a sair do banco para o psicólogo.
 */
export function PatientDiarySection({ clienteUserId }: { clienteUserId: string }) {
  const [entradas, setEntradas] = useState<EntradaDiario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    listDiario(supabase, clienteUserId)
      .then(setEntradas)
      .catch(() => setEntradas([]))
      .finally(() => setLoading(false));
  }, [clienteUserId]);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <BookLock className="h-4 w-4" />
        Diário compartilhado
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Aparecem aqui apenas as anotações que o paciente escolheu compartilhar.
      </p>

      {loading && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Carregando...
        </p>
      )}

      {!loading && entradas.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
          Nenhuma anotação compartilhada até agora.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {entradas.map((entrada) => (
          <div
            key={entrada.id}
            className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              <Eye className="h-3.5 w-3.5" />
              {formatDateTime(entrada.createdAt)}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {entrada.conteudo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
