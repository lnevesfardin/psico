"use client";

import { useMemo } from "react";
import { Printer, X } from "lucide-react";
import {
  COMPLEXIDADE_LABELS,
  TIPO_FICHA_LABELS,
  type Complexidade,
  type Patient,
  type TipoFicha,
} from "@/lib/dashboard-data";
import { formatDateShort } from "@/lib/format";

const TIPOS: TipoFicha[] = ["individuo", "casal", "grupo"];
const NIVEIS: Complexidade[] = ["alta", "media", "baixa"];

/** Dias sem sessão a partir dos quais a ficha entra na lista de atenção. */
const DIAS_SEM_SESSAO = 30;

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Panorama da carteira de pacientes, calculado no navegador a partir da lista
 * já carregada — sem consulta nova e sem tocar em conteúdo de prontuário.
 *
 * O relatório responde três perguntas práticas: quantas fichas de cada tipo,
 * como está distribuída a complexidade, e quem está há tempo demais sem
 * sessão registrada (o caso que passa despercebido numa lista alfabética).
 */
export function PatientsReportModal({
  patients,
  onClose,
}: {
  patients: Patient[];
  onClose: () => void;
}) {
  const dados = useMemo(() => {
    const porTipo = { individuo: 0, casal: 0, grupo: 0 } as Record<TipoFicha, number>;
    const porComplexidade = { alta: 0, media: 0, baixa: 0 } as Record<
      Complexidade,
      number
    >;
    let semClassificacao = 0;
    let semSessao = 0;

    for (const p of patients) {
      porTipo[p.tipo] += 1;
      if (p.complexidade) porComplexidade[p.complexidade] += 1;
      else semClassificacao += 1;
      if (!p.ultimaSessaoEm) semSessao += 1;
    }

    const paradas = patients
      .filter(
        (p) => p.ultimaSessaoEm && diasDesde(p.ultimaSessaoEm) >= DIAS_SEM_SESSAO
      )
      .sort((a, b) => a.ultimaSessaoEm!.localeCompare(b.ultimaSessaoEm!));

    const totalSessoes = patients.reduce((soma, p) => soma + p.totalSessoes, 0);

    return {
      porTipo,
      porComplexidade,
      semClassificacao,
      semSessao,
      paradas,
      totalSessoes,
    };
  }, [patients]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0">
      <div
        className="absolute inset-0 bg-black/40 print:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 print:max-h-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4 dark:border-zinc-800 print:hidden">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Relatório de pacientes
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Panorama da sua carteira em {formatDateShort(new Date().toISOString())}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="documento-para-impressao"
          className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0 print:text-black"
        >
          <h2 className="hidden text-lg font-bold print:block">
            Relatório de pacientes — {formatDateShort(new Date().toISOString())}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <Cartao titulo="Fichas no total" valor={patients.length} />
            <Cartao titulo="Sessões registradas" valor={dados.totalSessoes} />
          </div>

          <Secao titulo="Por tipo de atendimento">
            {TIPOS.map((tipo) => (
              <Linha
                key={tipo}
                rotulo={TIPO_FICHA_LABELS[tipo]}
                valor={dados.porTipo[tipo]}
                total={patients.length}
              />
            ))}
          </Secao>

          <Secao titulo="Por complexidade">
            {NIVEIS.map((nivel) => (
              <Linha
                key={nivel}
                rotulo={COMPLEXIDADE_LABELS[nivel]}
                valor={dados.porComplexidade[nivel]}
                total={patients.length}
              />
            ))}
            <Linha
              rotulo="Não classificadas"
              valor={dados.semClassificacao}
              total={patients.length}
            />
          </Secao>

          <Secao titulo={`Sem sessão há ${DIAS_SEM_SESSAO} dias ou mais`}>
            {dados.paradas.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 print:text-black">
                Nenhuma ficha nessa situação.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dados.paradas.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-zinc-700 dark:text-zinc-300 print:text-black">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400 print:text-black">
                      {formatDateShort(p.ultimaSessaoEm!)} ·{" "}
                      {diasDesde(p.ultimaSessaoEm!)} dias
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {dados.semSessao > 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 print:text-black">
                Além dessas, {dados.semSessao} ficha(s) ainda não têm nenhuma
                sessão registrada.
              </p>
            )}
          </Secao>
        </div>

        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Printer className="h-4 w-4" />
            Imprimir ou salvar em PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function Cartao({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 print:border-zinc-300 print:bg-white">
      <p className="text-2xl font-bold text-zinc-900 dark:text-white print:text-black">
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 print:text-black">
        {titulo}
      </p>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white print:text-black">
        {titulo}
      </h4>
      <div className="mt-2 space-y-1.5">{children}</div>
    </section>
  );
}

function Linha({
  rotulo,
  valor,
  total,
}: {
  rotulo: string;
  valor: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm text-zinc-600 dark:text-zinc-400 print:text-black">
        {rotulo}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 print:hidden">
        <span
          className="block h-full rounded-full bg-brand-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-16 shrink-0 text-right text-sm font-medium text-zinc-900 dark:text-white print:text-black">
        {valor} ({pct}%)
      </span>
    </div>
  );
}
