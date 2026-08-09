"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  FileSignature,
  Lock,
  Mic,
  PenLine,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Appointment, FormatoEvolucao, SessionNote } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/client";
import {
  addAdendo,
  addSessionNote,
  deleteSessionNote,
  signSessionNote,
  updateSessionNoteContent,
} from "@/lib/patients-client";
import { useAppointments } from "@/context/appointments-context";
import { SessionTranscriptionModal } from "@/components/dashboard/session-transcription-modal";
import { formatDateShort, formatDateTime } from "@/lib/format";

const FORMATO_LABEL: Record<FormatoEvolucao, string> = {
  dap: "DAP",
  soap: "SOAP",
  birp: "BIRP",
  livre: "Texto livre",
};

// Campos de cada formato: [rótulo, cabeçalho markdown usado ao compor o
// texto final]. A estrutura só existe no momento da composição — depois de
// criado o rascunho, a edição/autosave é sobre o texto já composto (não há
// re-parsing de seções), pra não arriscar perder conteúdo tentando quebrar
// de volta em campos.
const FORMATO_CAMPOS: Record<Exclude<FormatoEvolucao, "livre">, [string, string][]> = {
  dap: [
    ["Dados", "Dados"],
    ["Avaliação", "Avaliação"],
    ["Plano", "Plano"],
  ],
  soap: [
    ["Subjetivo", "Subjetivo"],
    ["Objetivo", "Objetivo"],
    ["Avaliação", "Avaliação"],
    ["Plano", "Plano"],
  ],
  birp: [
    ["Comportamento", "Comportamento"],
    ["Intervenção", "Intervenção"],
    ["Resposta", "Resposta"],
    ["Plano", "Plano"],
  ],
};

function composeContent(formato: FormatoEvolucao, campos: Record<string, string>, livre: string) {
  if (formato === "livre") return livre.trim();
  return FORMATO_CAMPOS[formato]
    .map(([campo, titulo]) => `## ${titulo}\n${(campos[campo] ?? "").trim()}`)
    .filter((bloco) => bloco.split("\n").slice(1).join("").trim().length > 0)
    .join("\n\n");
}

export function PatientEvolucaoTab({
  patientId,
  patientName,
  initialSessions,
  onSessionsChange,
}: {
  patientId: string;
  patientName: string;
  initialSessions: SessionNote[];
  onSessionsChange: (sessions: SessionNote[]) => void;
}) {
  const { appointments } = useAppointments();
  const [sessions, setSessions] = useState(initialSessions);
  const [composerOpen, setComposerOpen] = useState(false);
  const [formato, setFormato] = useState<FormatoEvolucao>("livre");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [livre, setLivre] = useState("");
  const [agendamentoId, setAgendamentoId] = useState<string>("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adendoOpenFor, setAdendoOpenFor] = useState<string | null>(null);
  const [adendoTexto, setAdendoTexto] = useState("");
  const [adendoMotivo, setAdendoMotivo] = useState("");
  const loggedRead = useRef(false);

  // "Toda leitura de evolução grava em audit_log" — este componente só
  // monta quando a aba Evolução é de fato aberta (ver o `tab === "evolucao"
  // && <PatientEvolucaoTab ...>` na página do paciente), então o mount é o
  // sinal certo de leitura. Só loga se já existe algo pra ler — abrir a aba
  // vazia num paciente novo não é "acesso a dado clínico" de ninguém ainda.
  useEffect(() => {
    if (loggedRead.current || initialSessions.length === 0) return;
    loggedRead.current = true;
    const supabase = createClient();
    supabase.rpc("registrar_auditoria", {
      p_acao: "leu_evolucao",
      p_entidade: "sessoes_prontuario",
      p_entidade_id: null,
      p_paciente_id: patientId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [savingAdendo, setSavingAdendo] = useState(false);

  const lastSaved = useRef("");

  function updateSessions(next: SessionNote[]) {
    setSessions(next);
    onSessionsChange(next);
  }

  // Consultas "realizada" deste paciente que ainda não têm evolução
  // vinculada — pra sugerir no composer (ver alerta "sessões sem evolução"
  // na Agenda, que usa o mesmo critério).
  const vinculadas = new Set(sessions.map((s) => s.agendamentoId).filter(Boolean));
  const consultasSemEvolucao = appointments.filter(
    (a: Appointment) =>
      a.patientId === patientId && a.status === "realizada" && !vinculadas.has(a.id)
  );

  const currentContent = () => composeContent(formato, campos, livre);

  async function ensureDraft() {
    const content = currentContent();
    if (!content) return null;
    if (draftId) return draftId;
    const supabase = createClient();
    const note = await addSessionNote(
      supabase,
      patientId,
      content,
      formato,
      { origem: "manual" },
      agendamentoId || null
    );
    setDraftId(note.id);
    lastSaved.current = content;
    updateSessions([note, ...sessions]);
    return note.id;
  }

  // Autosave a cada 10s enquanto o composer estiver aberto e o conteúdo
  // tiver mudado desde o último save (spec: "autosave a cada 10 segundos").
  useEffect(() => {
    if (!composerOpen) return;
    const interval = setInterval(async () => {
      const content = currentContent();
      if (!content || content === lastSaved.current) return;
      setSaving(true);
      try {
        const id = draftId ?? (await ensureDraft());
        if (id && content !== lastSaved.current) {
          const supabase = createClient();
          await updateSessionNoteContent(supabase, id, content);
          lastSaved.current = content;
          updateSessions(
            sessions.map((s) => (s.id === id ? { ...s, content } : s))
          );
        }
      } finally {
        setSaving(false);
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen, formato, campos, livre, draftId]);

  function resetComposer() {
    setComposerOpen(false);
    setFormato("livre");
    setCampos({});
    setLivre("");
    setAgendamentoId("");
    setDraftId(null);
    lastSaved.current = "";
  }

  async function handleSign() {
    const content = currentContent();
    if (!content) return;
    setSigning(true);
    try {
      const supabase = createClient();
      const id = draftId ?? (await ensureDraft());
      if (!id) return;
      if (content !== lastSaved.current) {
        await updateSessionNoteContent(supabase, id, content);
      }
      const { assinadoEm } = await signSessionNote(supabase, id, content);
      updateSessions(
        sessions.map((s) =>
          s.id === id
            ? { ...s, content, status: "assinada", assinadoEm }
            : s
        )
      );
      resetComposer();
    } finally {
      setSigning(false);
    }
  }

  async function handleDiscardDraft() {
    if (!draftId) {
      resetComposer();
      return;
    }
    const confirmed = window.confirm("Descartar este rascunho? Não pode ser desfeito.");
    if (!confirmed) return;
    const supabase = createClient();
    await deleteSessionNote(supabase, draftId);
    updateSessions(sessions.filter((s) => s.id !== draftId));
    resetComposer();
  }

  async function handleDeleteDraft(sessionId: string) {
    const confirmed = window.confirm(
      "Apagar este rascunho do histórico? Não pode ser desfeito."
    );
    if (!confirmed) return;
    setDeletingId(sessionId);
    try {
      const supabase = createClient();
      await deleteSessionNote(supabase, sessionId);
      updateSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Não foi possível apagar a anotação."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddAdendo(evolucaoId: string) {
    if (!adendoTexto.trim()) return;
    setSavingAdendo(true);
    try {
      const supabase = createClient();
      const adendo = await addAdendo(supabase, evolucaoId, adendoTexto.trim(), adendoMotivo.trim());
      updateSessions(
        sessions.map((s) =>
          s.id === evolucaoId ? { ...s, adendos: [...s.adendos, adendo] } : s
        )
      );
      setAdendoOpenFor(null);
      setAdendoTexto("");
      setAdendoMotivo("");
    } finally {
      setSavingAdendo(false);
    }
  }

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  );

  return (
    <div className="mt-6">
      {!composerOpen && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <Plus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                Nova evolução
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                DAP, SOAP, BIRP ou texto livre
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTranscribeOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-left transition-colors hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/40 dark:hover:bg-brand-950/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <Mic className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-brand-900 dark:text-brand-200">
                Transcrever sessão
              </span>
              <span className="block text-xs text-brand-700/80 dark:text-brand-300/70">
                O áudio não é armazenado.
              </span>
            </span>
          </button>
        </div>
      )}

      {composerOpen && (
        <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Lock className="h-4 w-4 text-zinc-400" />
              Nova evolução (sigilosa)
            </label>
            {saving && (
              <span className="text-xs text-zinc-400 dark:text-zinc-600">Salvando...</span>
            )}
          </div>

          <div className="mt-3 inline-flex w-full rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
            {(["livre", "dap", "soap", "birp"] as const).map((f) => (
              <button
                key={f}
                type="button"
                disabled={Boolean(draftId)}
                onClick={() => setFormato(f)}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  formato === f
                    ? "bg-brand-600 text-white"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {FORMATO_LABEL[f]}
              </button>
            ))}
          </div>

          {consultasSemEvolucao.length > 0 && (
            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Consulta relacionada (opcional)
              <select
                value={agendamentoId}
                onChange={(e) => setAgendamentoId(e.target.value)}
                disabled={Boolean(draftId)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Nenhuma / avulsa</option>
                {consultasSemEvolucao.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatDateShort(a.date)} às {a.time}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-3 space-y-3">
            {formato === "livre" ? (
              <textarea
                value={livre}
                onChange={(e) => setLivre(e.target.value)}
                rows={5}
                placeholder="Registre a evolução da sessão..."
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            ) : (
              FORMATO_CAMPOS[formato].map(([campo]) => (
                <label
                  key={campo}
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {campo}
                  <textarea
                    value={campos[campo] ?? ""}
                    onChange={(e) =>
                      setCampos((prev) => ({ ...prev, [campo]: e.target.value }))
                    }
                    rows={2}
                    className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSign}
              disabled={signing || !currentContent()}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileSignature className="h-4 w-4" />
              {signing ? "Assinando..." : "Assinar"}
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {draftId ? "Descartar rascunho" : "Cancelar"}
            </button>
            <p className="ml-auto text-xs text-zinc-400 dark:text-zinc-600">
              Assinar congela o conteúdo — depois disso, correção só por adendo.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Histórico de sessões
        </h3>
        <div className="mt-3 space-y-3">
          {sortedSessions.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Nenhuma anotação registrada ainda.
            </p>
          )}
          {sortedSessions.map((session) => (
            <div
              key={session.id}
              className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-600">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(session.dateTime)}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {FORMATO_LABEL[session.formato]}
                  </span>
                  {session.status === "assinada" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                      Assinada {session.assinadoEm ? formatDateShort(session.assinadoEm) : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <PenLine className="h-3 w-3" />
                      Rascunho pendente
                    </span>
                  )}
                  {session.origem === "transcricao" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      <Mic className="h-3 w-3" />
                      Transcrição
                    </span>
                  )}
                </div>
                {session.status === "rascunho" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(session.id)}
                    disabled={deletingId === session.id}
                    aria-label="Apagar rascunho"
                    className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {session.content}
              </p>

              {session.adendos.map((adendo) => (
                <div
                  key={adendo.id}
                  className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Adendo · {formatDateTime(adendo.createdAt)}
                    {adendo.motivo ? ` · ${adendo.motivo}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {adendo.texto}
                  </p>
                </div>
              ))}

              {session.status === "assinada" && (
                <div className="mt-3">
                  {adendoOpenFor === session.id ? (
                    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                      <textarea
                        value={adendoTexto}
                        onChange={(e) => setAdendoTexto(e.target.value)}
                        rows={2}
                        placeholder="Texto do adendo..."
                        className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                      <input
                        type="text"
                        value={adendoMotivo}
                        onChange={(e) => setAdendoMotivo(e.target.value)}
                        placeholder="Motivo (opcional)"
                        className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddAdendo(session.id)}
                          disabled={savingAdendo || !adendoTexto.trim()}
                          className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingAdendo ? "Salvando..." : "Salvar adendo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdendoOpenFor(null)}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdendoOpenFor(session.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      <Plus className="h-3 w-3" />
                      Adendo
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {transcribeOpen && (
        <SessionTranscriptionModal
          patientName={patientName}
          onClose={() => setTranscribeOpen(false)}
          onSave={async ({ texto, duracaoSegundos, consentimentoEm }) => {
            const supabase = createClient();
            const note = await addSessionNote(
              supabase,
              patientId,
              texto,
              "livre",
              { origem: "transcricao", consentimentoEm, duracaoSegundos }
            );
            updateSessions([note, ...sessions]);
            setTranscribeOpen(false);
          }}
        />
      )}
    </div>
  );
}
