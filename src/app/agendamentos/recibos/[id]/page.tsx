"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getRecibo } from "@/lib/recibos-client";
import type { Recibo } from "@/lib/dashboard-data";
import { formatCurrency, formatDateShort } from "@/lib/format";

type PsicologoInfo = { nome: string; titulo: string; crp: string };

// Mesmo padrão de impressão do prontuário/recibo do lado do psicólogo (ver
// src/app/dashboard/financeiro/recibos/[id]/page.tsx) — mas o paciente não
// tem acesso ao ProfileProvider do psicólogo (contextos diferentes por
// layout), então busca o nome/CRP via a view pública perfis_publico.
export default function MeuReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [psicologo, setPsicologo] = useState<PsicologoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    getRecibo(supabase, id).then(async (r) => {
      setRecibo(r);
      if (r) {
        const { data } = await supabase
          .from("perfis_publico")
          .select("nome, titulo, crp")
          .eq("id", r.psicologoId)
          .single();
        setPsicologo(data as PsicologoInfo | null);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-500">Carregando...</p>;
  }
  if (!recibo) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-500">Recibo não encontrado.</p>;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/agendamentos/recibos"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir / Salvar como PDF
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-sm leading-7 text-zinc-800 print:mt-0 print:border-0 dark:border-zinc-800 dark:text-zinc-200">
        <h1 className="text-center text-lg font-bold uppercase tracking-wide text-zinc-900 dark:text-white">
          Recibo
        </h1>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nº {recibo.numero}
        </p>

        <p className="mt-8 text-justify">
          Recebi de <strong>{recibo.pagadorNome}</strong>, portador(a) do CPF{" "}
          <strong>{recibo.pagadorCpf}</strong>, a quantia de{" "}
          <strong>{formatCurrency(recibo.valorTotal)}</strong> referente a{" "}
          <strong>{recibo.quantidadeSessoes}</strong> sessão(ões) de atendimento psicológico, no
          período de {formatDateShort(recibo.competenciaInicio)} a{" "}
          {formatDateShort(recibo.competenciaFim)}.
        </p>

        <p className="mt-4 text-justify">
          Para os devidos fins, inclusive de declaração de Imposto de Renda,
          firmo o presente recibo.
        </p>

        <div className="mt-16 text-center">
          <p>{formatDateShort(recibo.emitidoEm.slice(0, 10))}</p>
        </div>

        <div className="mx-auto mt-16 max-w-xs border-t border-zinc-400 pt-2 text-center">
          <p className="font-semibold">{psicologo?.nome ?? ""}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {psicologo?.titulo} · {psicologo?.crp}
          </p>
        </div>
      </div>
    </main>
  );
}
