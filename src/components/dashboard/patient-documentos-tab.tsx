"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/dashboard-data";
import {
  composeAtestado,
  composeDeclaracao,
  emitirDocumento,
  listDocumentosByPatient,
  type Documento,
  type TipoDocumento,
} from "@/lib/documentos-client";
import { formatDateShort } from "@/lib/format";

const TIPO_LABEL: Record<TipoDocumento, string> = {
  declaracao: "Declaração",
  atestado: "Atestado",
};

export function PatientDocumentosTab({ patient }: { patient: Patient }) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumento>("declaracao");
  const [finalidade, setFinalidade] = useState("");
  const [diasAfastamento, setDiasAfastamento] = useState("");
  const [dataInicioAfastamento, setDataInicioAfastamento] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    listDocumentosByPatient(supabase, patient.id)
      .then(setDocumentos)
      .finally(() => setLoading(false));
  }, [patient.id]);

  function resetForm() {
    setFormOpen(false);
    setTipo("declaracao");
    setFinalidade("");
    setDiasAfastamento("");
    setDataInicioAfastamento("");
    setErro(null);
  }

  async function handleEmitir(e: React.FormEvent) {
    e.preventDefault();
    if (!finalidade.trim()) return;
    setSaving(true);
    setErro(null);
    try {
      const dias = diasAfastamento ? Number(diasAfastamento) : null;
      const conteudo =
        tipo === "declaracao"
          ? composeDeclaracao({
              pacienteNome: patient.nomeSocial || patient.name,
              pacienteCpf: patient.cpf,
              finalidade: finalidade.trim(),
            })
          : composeAtestado({
              pacienteNome: patient.nomeSocial || patient.name,
              pacienteCpf: patient.cpf,
              finalidade: finalidade.trim(),
              diasAfastamento: dias,
              dataInicioAfastamento: dataInicioAfastamento || null,
            });
      const supabase = createClient();
      const documento = await emitirDocumento(supabase, {
        patientId: patient.id,
        tipo,
        finalidade: finalidade.trim(),
        conteudo,
        diasAfastamento: dias,
        dataInicioAfastamento: dataInicioAfastamento || null,
      });
      setDocumentos((prev) => [documento, ...prev]);
      resetForm();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível emitir o documento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Emitir documento
        </button>
      ) : (
        <form
          onSubmit={handleEmitir}
          className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          {erro && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
              {erro}
            </div>
          )}

          <div className="inline-flex w-full rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
            {(Object.keys(TIPO_LABEL) as TipoDocumento[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tipo === t ? "bg-brand-600 text-white" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>

          <label className="mt-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Finalidade
            <input
              type="text"
              required
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              placeholder={
                tipo === "declaracao"
                  ? "Ex.: comprovação de comparecimento a atendimento"
                  : "Ex.: apresentação ao empregador"
              }
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          {tipo === "atestado" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Dias de afastamento
                <input
                  type="number"
                  min={1}
                  value={diasAfastamento}
                  onChange={(e) => setDiasAfastamento(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                A partir de
                <input
                  type="date"
                  value={dataInicioAfastamento}
                  onChange={(e) => setDataInicioAfastamento(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
            </div>
          )}

          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
            O texto segue a estrutura padrão da Resolução CFP nº 06/2019 e nunca expõe
            diagnóstico — depois de emitido, o documento não pode mais ser editado (só
            emitir um novo, se precisar corrigir algo).
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !finalidade.trim()}
              className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Emitindo..." : "Emitir documento"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {documentos.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            Nenhum documento emitido ainda.
          </p>
        )}
        {documentos.map((d) => (
          <Link
            key={d.id}
            href={`/dashboard/pacientes/${patient.id}/documentos/${d.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {TIPO_LABEL[d.tipo]} nº {d.numero}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600">{d.finalidade}</p>
              </div>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-600">
              {formatDateShort(d.emitidoEm.slice(0, 10))}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
