"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, ListChecks, Sparkles, SmilePlus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/dashboard-data";
import { listMoodCheckins, MOOD_LABELS, type MoodCheckin } from "@/lib/mood-client";
import { listTarefasByPatient, type Tarefa } from "@/lib/tarefas-client";
import { listAplicacoesByPatient, type AplicacaoInstrumento } from "@/lib/instrumentos-client";
import { listObjetivosAbertosByPatient, type Objetivo } from "@/lib/planos-terapeuticos-client";
import {
  gerarResumoPreSessao,
  gerarTextoAdministrativo,
  identificarTemasRecorrentes,
  type TipoAssistenteAdministrativo,
} from "@/lib/ia-client";
import { formatDateShort } from "@/lib/format";

const AVISO_IA =
  "Gerado com apoio de IA a partir do histórico registrado. Não é uma conclusão clínica — a interpretação é sempre sua.";
const BANNER_IA_CURTO = "Rascunho gerado com IA. Revise antes de enviar.";

export function PatientAntesDaSessaoTab({ patient }: { patient: Patient }) {
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [aplicacoes, setAplicacoes] = useState<AplicacaoInstrumento[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumoIa, setResumoIa] = useState<string | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [resumoErro, setResumoErro] = useState<string | null>(null);
  const [temasIa, setTemasIa] = useState<string[] | null>(null);
  const [temasLoading, setTemasLoading] = useState(false);
  const [temasErro, setTemasErro] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      patient.clienteUserId ? listMoodCheckins(supabase, patient.clienteUserId, 5) : Promise.resolve([]),
      listTarefasByPatient(supabase, patient.id),
      listAplicacoesByPatient(supabase, patient.id),
      listObjetivosAbertosByPatient(supabase, patient.id),
    ])
      .then(([c, t, a, o]) => {
        setCheckins(c);
        setTarefas(t);
        setAplicacoes(a);
        setObjetivos(o);
      })
      .finally(() => setLoading(false));
  }, [patient.id, patient.clienteUserId]);

  async function handleGerarResumo() {
    setResumoLoading(true);
    setResumoErro(null);
    try {
      const resumo = await gerarResumoPreSessao(patient.id);
      setResumoIa(resumo);
    } catch (err) {
      setResumoErro(err instanceof Error ? err.message : "Não foi possível gerar o resumo.");
    } finally {
      setResumoLoading(false);
    }
  }

  async function handleIdentificarTemas() {
    setTemasLoading(true);
    setTemasErro(null);
    try {
      const temas = await identificarTemasRecorrentes(patient.id);
      setTemasIa(temas);
    } catch (err) {
      setTemasErro(err instanceof Error ? err.message : "Não foi possível identificar temas.");
    } finally {
      setTemasLoading(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  const tarefasPendentes = tarefas
    .filter((t) => !t.concluidaEm)
    .sort((a, b) => (a.prazo ?? "9999") < (b.prazo ?? "9999") ? -1 : 1);
  const escalasRespondidas = aplicacoes.filter((a) => a.respondidoEm).slice(0, 5);
  const algumAlerta = checkins.some((c) => c.mood <= 2);

  return (
    <div className="mt-6 space-y-6">
      <Secao icon={Sparkles} titulo="Resumo pré-sessão (IA)">
        {resumoErro && (
          <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {resumoErro}
          </div>
        )}
        {resumoIa ? (
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-900 dark:bg-brand-950/30">
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{resumoIa}</p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">{AVISO_IA}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGerarResumo}
            disabled={resumoLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {resumoLoading ? "Gerando..." : "Gerar resumo das últimas evoluções"}
          </button>
        )}
      </Secao>

      {algumAlerta && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-sm text-rose-800 dark:text-rose-200">
            Humor baixo registrado recentemente — vale conferir antes da sessão.
          </p>
        </div>
      )}

      <Secao icon={SmilePlus} titulo="Humor recente">
        {!patient.clienteUserId ? (
          <VazioTexto texto="Paciente ainda não tem conta própria para registrar humor." />
        ) : checkins.length === 0 ? (
          <VazioTexto texto="Nenhum check-in registrado ainda." />
        ) : (
          <ul className="space-y-1.5">
            {checkins.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50"
              >
                <span className="text-zinc-700 dark:text-zinc-300">{formatDateShort(c.date)}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {MOOD_LABELS[c.mood]} · Energia {c.energy}/5
                  {c.anxiety ? ` · Ansiedade ${c.anxiety}/5` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={ListChecks} titulo="Tarefas pendentes">
        {tarefasPendentes.length === 0 ? (
          <VazioTexto texto="Nenhuma tarefa pendente." />
        ) : (
          <ul className="space-y-1.5">
            {tarefasPendentes.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50"
              >
                <span className="text-zinc-700 dark:text-zinc-300">{t.titulo}</span>
                {t.prazo && (
                  <span className="text-zinc-400 dark:text-zinc-600">{formatDateShort(t.prazo)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={ClipboardCheck} titulo="Escalas respondidas recentemente">
        {escalasRespondidas.length === 0 ? (
          <VazioTexto texto="Nenhuma escala respondida ainda." />
        ) : (
          <ul className="space-y-1.5">
            {escalasRespondidas.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  {a.instrumentoSigla} · {formatDateShort(a.respondidoEm!)}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {a.escore} ({a.faixa})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={Target} titulo="Objetivos em aberto">
        {objetivos.length === 0 ? (
          <VazioTexto texto="Nenhum objetivo em aberto." />
        ) : (
          <ul className="space-y-1.5">
            {objetivos.map((o) => (
              <li key={o.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50">
                <p className="text-zinc-700 dark:text-zinc-300">{o.descricao}</p>
                {o.indicador && (
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                    Indicador: {o.indicador}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao icon={Sparkles} titulo="Temas recorrentes (IA)">
        {temasErro && (
          <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {temasErro}
          </div>
        )}
        {temasIa ? (
          temasIa.length === 0 ? (
            <VazioTexto texto="Nenhum padrão identificado com confiança até agora." />
          ) : (
            <div>
              <ul className="space-y-1.5">
                {temasIa.map((tema, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300"
                  >
                    {tema}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
                Observações, não conclusões — {AVISO_IA.charAt(0).toLowerCase() + AVISO_IA.slice(1)}
              </p>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={handleIdentificarTemas}
            disabled={temasLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {temasLoading ? "Analisando..." : "Identificar temas recorrentes"}
          </button>
        )}
      </Secao>

      <AssistenteAdministrativo patientId={patient.id} />
    </div>
  );
}

function Secao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <Icon className="h-4 w-4" />
        {titulo}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function VazioTexto({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
      {texto}
    </p>
  );
}

const TIPO_LABEL: Record<TipoAssistenteAdministrativo, string> = {
  remarcacao: "Remarcação",
  orientacao: "Orientação ao paciente",
  tarefa_casa: "Tarefa de casa",
};

const TIPO_PLACEHOLDER: Record<TipoAssistenteAdministrativo, string> = {
  remarcacao: "Ex.: preciso remarcar a sessão de quinta porque vou viajar, sugerir a semana seguinte.",
  orientacao: "Ex.: pedir para registrar o humor todos os dias até a próxima sessão.",
  tarefa_casa: "Ex.: exercício de respiração diafragmática, 5 minutos por dia.",
};

// Redige mensagens administrativas (remarcação, orientação, tarefa de casa)
// a partir de um contexto curto — item 4 do módulo de IA. Fica num único
// ponto de entrada (em vez de espalhar "gerar com IA" em cada formulário)
// pra manter as travas (consentimento, IA ligada na org) num só lugar.
function AssistenteAdministrativo({ patientId }: { patientId: string }) {
  const [tipo, setTipo] = useState<TipoAssistenteAdministrativo>("remarcacao");
  const [contexto, setContexto] = useState("");
  const [texto, setTexto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function handleGerar() {
    if (!contexto.trim()) return;
    setLoading(true);
    setErro(null);
    try {
      const resultado = await gerarTextoAdministrativo({ patientId, tipo, contexto: contexto.trim() });
      setTexto(resultado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível gerar o texto.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopiar() {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  return (
    <Secao icon={Sparkles} titulo="Assistente administrativo (IA)">
      <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
        {(Object.keys(TIPO_LABEL) as TipoAssistenteAdministrativo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTipo(t);
              setTexto(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tipo === t ? "bg-brand-600 text-white" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      {erro && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {erro}
        </div>
      )}

      <textarea
        value={contexto}
        onChange={(e) => setContexto(e.target.value)}
        rows={2}
        placeholder={TIPO_PLACEHOLDER[tipo]}
        className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      />
      <button
        type="button"
        onClick={handleGerar}
        disabled={loading || !contexto.trim()}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {loading ? "Gerando..." : "Gerar rascunho"}
      </button>

      {texto && (
        <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-900 dark:bg-brand-950/30">
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{texto}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{BANNER_IA_CURTO}</p>
            <button
              type="button"
              onClick={handleCopiar}
              className="shrink-0 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </Secao>
  );
}
