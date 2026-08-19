"use client";

import { useEffect, useState } from "react";
import { ListChecks, Loader2, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calcularAdesao,
  HABITOS,
  habitoIcone,
  habitoLabel,
  listHabitosDoPaciente,
  listRegistrosHabito,
  setHabitosDoPaciente,
  type HabitoChave,
  type RegistroHabito,
} from "@/lib/habitos-client";

const DIAS_JANELA = 30;

function isoDiasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function PatientHabitsSection({
  pacienteId,
  clienteUserId,
}: {
  pacienteId: string;
  clienteUserId: string | null;
}) {
  const [ativos, setAtivos] = useState<HabitoChave[]>([]);
  const [registros, setRegistros] = useState<RegistroHabito[]>([]);
  const [loading, setLoading] = useState(true);
  const [configurando, setConfigurando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const tarefas: [Promise<HabitoChave[]>, Promise<RegistroHabito[]>] = [
      listHabitosDoPaciente(supabase, pacienteId),
      clienteUserId
        ? listRegistrosHabito(supabase, clienteUserId, isoDiasAtras(DIAS_JANELA))
        : Promise.resolve([]),
    ];
    Promise.all(tarefas)
      .then(([chaves, regs]) => {
        setAtivos(chaves);
        setRegistros(regs);
      })
      .catch(() => setError("Não foi possível carregar os hábitos."))
      .finally(() => setLoading(false));
  }, [pacienteId, clienteUserId]);

  async function alternarHabito(chave: HabitoChave) {
    const novos = ativos.includes(chave)
      ? ativos.filter((c) => c !== chave)
      : [...ativos, chave];
    const anterior = ativos;
    setAtivos(novos);
    setSalvando(true);
    setError(null);
    try {
      const supabase = createClient();
      await setHabitosDoPaciente(supabase, pacienteId, novos);
    } catch (err) {
      setAtivos(anterior);
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando hábitos...
        </p>
      </div>
    );
  }

  const adesao = calcularAdesao(registros, ativos);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <ListChecks className="h-4 w-4" />
            Rotina e hábitos
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {ativos.length === 0
              ? "Escolha quais hábitos este paciente vai acompanhar diariamente."
              : `Adesão dos últimos ${DIAS_JANELA} dias.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfigurando((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-brand-400"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {configurando ? "Fechar" : "Configurar"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {configurando && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Marque só o que faz sentido para este paciente — caixinha que não se
            aplica vira falso &quot;não aderiu&quot; no acompanhamento.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HABITOS.map(({ chave, label, icone: Icone }) => {
              const ligado = ativos.includes(chave);
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => alternarHabito(chave)}
                  disabled={salvando}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                    ligado
                      ? "border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200"
                      : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  <Icone className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ativos.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {!clienteUserId && (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Os hábitos já estão definidos. O paciente passa a marcá-los quando
              criar a conta pelo convite.
            </p>
          )}
          {clienteUserId && (
            <>
              {adesao
                .filter(({ dias }) => dias > 0)
                .map(({ chave, feitos, dias, pct }) => {
                  const Icone = habitoIcone(chave);
                  return (
                  <div key={chave}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <Icone className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                        {habitoLabel(chave)}
                      </span>
                      <span className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
                        {pct}% · {feitos}/{dias} dias
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 70
                            ? "bg-emerald-500"
                            : pct >= 40
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  );
                })}
              {/* Nenhum hábito com registro ainda: uma barra em 0% pra cada
                  um pareceria "o paciente não fez nada" quando na verdade
                  ele só ainda não teve chance de marcar. */}
              {adesao.every(({ dias }) => dias === 0) && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Aguardando os primeiros registros do paciente.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
