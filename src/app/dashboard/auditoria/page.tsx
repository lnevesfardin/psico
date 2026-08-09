"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ACAO_LABEL, listAuditoria, type RegistroAuditoria } from "@/lib/auditoria-client";
import { formatDateTime } from "@/lib/format";

export default function AuditoriaPage() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    listAuditoria(supabase)
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        <ShieldCheck className="h-6 w-6" />
        Log de acesso
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Trilha de acesso a dado clínico (leitura/assinatura de evolução, exportação de
        prontuário, uso de recursos de IA) — exigida pelas Resoluções CFP e pela LGPD.
        Mostra os últimos 100 registros.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      ) : registros.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
          Nenhum registro de acesso ainda.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Quando</th>
                <th className="px-4 py-2.5">Ação</th>
                <th className="px-4 py-2.5">Paciente</th>
                <th className="px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {registros.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-white">
                    {ACAO_LABEL[r.acao as keyof typeof ACAO_LABEL] ?? r.acao}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                    {r.pacienteNome ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400 dark:text-zinc-600">
                    {r.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
