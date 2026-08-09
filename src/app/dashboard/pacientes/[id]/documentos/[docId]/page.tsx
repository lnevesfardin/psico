"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDocumento, type Documento, type TipoDocumento } from "@/lib/documentos-client";
import { useProfile } from "@/context/profile-context";
import { formatDateShort } from "@/lib/format";

const TIPO_LABEL: Record<TipoDocumento, string> = {
  declaracao: "Declaração Psicológica",
  atestado: "Atestado Psicológico",
};

// Mesmo padrão de recibo/prontuário (window.print(), sem biblioteca de PDF).
export default function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = use(params);
  const { profile } = useProfile();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    getDocumento(supabase, docId)
      .then(setDocumento)
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-500">Carregando...</p>;
  }
  if (!documento) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-500">Documento não encontrado.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/pacientes/${id}?tab=documentos`}
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
          {TIPO_LABEL[documento.tipo]}
        </h1>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">Nº {documento.numero}</p>

        <p className="mt-8 whitespace-pre-wrap text-justify">{documento.conteudo}</p>

        <div className="mt-16 text-center">
          <p>{formatDateShort(documento.emitidoEm.slice(0, 10))}</p>
        </div>

        <div className="mx-auto mt-16 max-w-xs border-t border-zinc-400 pt-2 text-center">
          <p className="font-semibold">{profile.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {profile.title} · {profile.crp}
          </p>
        </div>
      </div>
    </div>
  );
}
