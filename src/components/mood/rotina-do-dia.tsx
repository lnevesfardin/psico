"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  habitoIcone,
  habitoLabel,
  listMeusHabitos,
  listRegistrosHabito,
  marcarHabito,
  type HabitoChave,
} from "@/lib/habitos-client";
import { todayIso } from "@/lib/format";

/**
 * Caixinhas da rotina de hoje. Só aparece se o psicólogo tiver ativado
 * algum hábito para este paciente (ver habitos_paciente no schema.sql) —
 * sem isso a tela mostraria uma lista vazia sem explicação.
 */
export function RotinaDoDia({ clienteId }: { clienteId: string }) {
  const [habitos, setHabitos] = useState<HabitoChave[]>([]);
  const [marcados, setMarcados] = useState<Set<HabitoChave>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hoje = todayIso();

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      listMeusHabitos(supabase),
      listRegistrosHabito(supabase, clienteId, hoje),
    ])
      .then(([ativos, registros]) => {
        setHabitos(ativos);
        setMarcados(
          new Set(
            registros
              .filter((r) => r.data === hoje && r.feito)
              .map((r) => r.chave)
          )
        );
      })
      .catch(() => setError("Não foi possível carregar sua rotina."))
      .finally(() => setLoading(false));
  }, [clienteId, hoje]);

  async function alternar(chave: HabitoChave) {
    const feito = !marcados.has(chave);
    setMarcados((prev) => {
      const next = new Set(prev);
      if (feito) next.add(chave);
      else next.delete(chave);
      return next;
    });
    try {
      const supabase = createClient();
      await marcarHabito(supabase, clienteId, hoje, chave, feito);
    } catch {
      // Volta ao estado anterior: deixar a caixinha marcada sem ter gravado
      // faria a pessoa achar que registrou o dia.
      setMarcados((prev) => {
        const next = new Set(prev);
        if (feito) next.delete(chave);
        else next.add(chave);
        return next;
      });
      setError("Não foi possível salvar. Tente de novo.");
    }
  }

  if (loading || (habitos.length === 0 && !error)) return null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <ListChecks className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        Rotina de hoje
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Marque o que você conseguiu fazer hoje. Sem cobrança — é só pra
        acompanhar.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {habitos.map((chave) => {
          const feito = marcados.has(chave);
          const Icone = habitoIcone(chave);
          return (
            <button
              key={chave}
              type="button"
              onClick={() => alternar(chave)}
              aria-pressed={feito}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                feito
                  ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700/60"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                  feito
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-300 text-transparent dark:border-zinc-600"
                }`}
              >
                ✓
              </span>
              <Icone
                aria-hidden
                className={`h-4 w-4 shrink-0 ${
                  feito
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              />
              <span
                className={
                  feito
                    ? "font-medium text-brand-900 dark:text-brand-200"
                    : "text-zinc-700 dark:text-zinc-300"
                }
              >
                {habitoLabel(chave)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
