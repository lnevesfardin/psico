"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPatientWithSessions } from "@/lib/patients-client";
import { listPlanos, listObjetivos, type Objetivo, type Plano } from "@/lib/planos-terapeuticos-client";
import { listAplicacoesByPatient, type AplicacaoInstrumento } from "@/lib/instrumentos-client";
import { useProfile } from "@/context/profile-context";
import type { Patient } from "@/lib/dashboard-data";
import { formatDateShort, formatDateTime } from "@/lib/format";

const FORMATO_LABEL = { dap: "DAP", soap: "SOAP", birp: "BIRP", livre: "Texto livre" };

// Exportação "PDF" via impressão do navegador (Ctrl+P / Salvar como PDF) —
// não há biblioteca de geração de PDF no projeto, e adicionar uma só pra
// isso seria uma dependência nova grande pra uma tela que já fica correta
// com CSS de impressão. Só entram evoluções ASSINADAS: rascunho não é
// prontuário oficial ainda.
export default function ProntuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile } = useProfile();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [objetivosPorPlano, setObjetivosPorPlano] = useState<Record<string, Objetivo[]>>({});
  const [aplicacoes, setAplicacoes] = useState<AplicacaoInstrumento[]>([]);
  const [loading, setLoading] = useState(true);
  const loggedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      getPatientWithSessions(supabase, id),
      listPlanos(supabase, id),
      listAplicacoesByPatient(supabase, id),
    ])
      .then(async ([p, pl, apl]) => {
        setPatient(p);
        setPlanos(pl);
        setAplicacoes(apl);
        const entries = await Promise.all(
          pl.map(async (plano) => [plano.id, await listObjetivos(supabase, plano.id)] as const)
        );
        setObjetivosPorPlano(Object.fromEntries(entries));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (loading || loggedRef.current) return;
    loggedRef.current = true;
    const supabase = createClient();
    supabase.rpc("registrar_auditoria", {
      p_acao: "exportou_prontuario",
      p_entidade: "pacientes",
      p_entidade_id: id,
      p_paciente_id: id,
    });
  }, [loading, id]);

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-zinc-500">Carregando...</p>;
  }
  if (!patient) {
    return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-zinc-500">Paciente não encontrado.</p>;
  }

  const evolucoesAssinadas = [...patient.sessions]
    .filter((s) => s.status === "assinada")
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/pacientes/${id}`}
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

      <div className="mt-8 print:mt-0">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
          Prontuário — {patient.nomeSocial || patient.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {profile.name} · {profile.title} · {profile.crp}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Exportado em {formatDateTime(new Date().toISOString())}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            <strong className="font-semibold">CPF:</strong> {patient.cpf || "—"}
          </p>
          <p>
            <strong className="font-semibold">Nascimento:</strong>{" "}
            {patient.birthDate ? formatDateShort(patient.birthDate) : "—"}
          </p>
          <p>
            <strong className="font-semibold">Telefone:</strong> {patient.phone || "—"}
          </p>
          <p>
            <strong className="font-semibold">E-mail:</strong> {patient.email || "—"}
          </p>
        </div>

        <hr className="mt-6 border-zinc-200 dark:border-zinc-800" />

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Evolução clínica ({evolucoesAssinadas.length} sessão(ões) assinada(s))
        </h2>

        {evolucoesAssinadas.length === 0 && (
          <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-600">
            Nenhuma evolução assinada ainda — rascunhos não entram no export.
          </p>
        )}

        <div className="mt-4 space-y-6">
          {evolucoesAssinadas.map((s) => (
            <div key={s.id} className="break-inside-avoid border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {formatDateTime(s.dateTime)} · {FORMATO_LABEL[s.formato]} · assinada em{" "}
                {s.assinadoEm ? formatDateTime(s.assinadoEm) : "—"}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                {s.content}
              </p>
              {s.adendos.map((a) => (
                <div key={a.id} className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm dark:border-zinc-700">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Adendo · {formatDateTime(a.createdAt)}
                    {a.motivo ? ` · ${a.motivo}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{a.texto}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Plano terapêutico e instrumentos entram no export por portabilidade
            — em caso de transferência de profissional, é dado clínico
            relevante pra continuidade do cuidado, não só a evolução. */}
        {planos.length > 0 && (
          <>
            <hr className="mt-6 border-zinc-200 dark:border-zinc-800" />
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Plano terapêutico
            </h2>
            <div className="mt-4 space-y-6">
              {planos.map((p) => (
                <div key={p.id} className="break-inside-avoid border-b border-zinc-100 pb-4 dark:border-zinc-800">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {p.abordagem || "Sem abordagem informada"} · status: {p.status} · criado em{" "}
                    {formatDateShort(p.createdAt)}
                  </div>
                  {p.hipoteseDiagnostica && (
                    <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      <strong className="font-semibold">Queixa / hipótese:</strong> {p.hipoteseDiagnostica}
                    </p>
                  )}
                  {p.objetivoGeral && (
                    <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                      <strong className="font-semibold">Objetivo geral:</strong> {p.objetivoGeral}
                    </p>
                  )}
                  {(objetivosPorPlano[p.id] ?? []).length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                      {objetivosPorPlano[p.id].map((o) => (
                        <li key={o.id}>
                          {o.descricao}
                          {o.indicador ? ` (indicador: ${o.indicador})` : ""} —{" "}
                          {o.status === "concluido" ? "concluído" : "em andamento"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {aplicacoes.some((a) => a.respondidoEm) && (
          <>
            <hr className="mt-6 border-zinc-200 dark:border-zinc-800" />
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Instrumentos psicométricos
            </h2>
            <div className="mt-4 space-y-2">
              {aplicacoes
                .filter((a) => a.respondidoEm)
                .map((a) => (
                  <p key={a.id} className="text-sm text-zinc-800 dark:text-zinc-200">
                    <strong className="font-semibold">{a.instrumentoSigla}</strong> —{" "}
                    {formatDateShort(a.respondidoEm!)} · escore {a.escore} ({a.faixa})
                  </p>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
