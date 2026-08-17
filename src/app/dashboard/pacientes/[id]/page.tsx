"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  CreditCard,
  Mail,
  Cake,
  HeartPulse,
  ShieldAlert,
  Lock,
  Clock,
  Trash2,
  Pencil,
  CalendarCheck,
  GraduationCap,
  HelpCircle,
  StickyNote,
  Mic,
  Users,
} from "lucide-react";
import { TIPO_FICHA_LABELS, type Patient } from "@/lib/dashboard-data";
import { ComplexidadeBar } from "@/components/dashboard/complexidade-bar";
import { createClient } from "@/lib/supabase/client";
import {
  addSessionNote,
  deletePatient,
  deleteSessionNote,
  getPatientWithSessions,
  patientToFormInput,
  updatePatient,
  updateSessionNote,
} from "@/lib/patients-client";
import { PatientFormModal } from "@/components/patient-form-modal";
import { PatientMoodTab } from "@/components/dashboard/patient-mood-tab";
import { PatientDocumentsTab } from "@/components/dashboard/patient-documents-tab";
import { PatientMaterialsTab } from "@/components/dashboard/patient-materials-tab";
import { RespostasEscalaList } from "@/components/dashboard/respostas-escala-list";
import { SessionTranscriptionModal } from "@/components/dashboard/session-transcription-modal";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { useProfile } from "@/context/profile-context";

const TAB_LABELS = {
  dados: "Dados Pessoais",
  evolucao: "Evolução / Prontuário",
  humor: "Acompanhamento",
  rastreio: "Rastreio",
  materiais: "Materiais",
  documentos: "Documentos",
} as const;

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile } = useProfile();
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "dados" | "evolucao" | "humor" | "materiais" | "documentos" | "rastreio"
  >("dados");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    getPatientWithSessions(supabase, id)
      .then(setPatient)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <Link
          href="/dashboard/pacientes"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <p className="mt-8 text-center text-zinc-500">Paciente não encontrado.</p>
      </div>
    );
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const newNote = await addSessionNote(supabase, patient.id, note.trim());
      setPatient((prev) =>
        prev ? { ...prev, sessions: [newNote, ...prev.sessions] } : prev
      );
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!patient) return;
    const confirmed = window.confirm(
      `Excluir ${patient.name}? Isso apaga também o prontuário e não pode ser desfeito.`
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const supabase = createClient();
      await deletePatient(supabase, patient.id);
      router.push("/dashboard/pacientes");
      router.refresh();
    } catch {
      setDeleteError("Não foi possível excluir o paciente.");
      setDeleting(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm(
      "Apagar esta anotação do histórico de sessão? Não pode ser desfeito."
    );
    if (!confirmed) return;
    setDeletingSessionId(sessionId);
    try {
      const supabase = createClient();
      await deleteSessionNote(supabase, sessionId);
      setPatient((prev) =>
        prev
          ? { ...prev, sessions: prev.sessions.filter((s) => s.id !== sessionId) }
          : prev
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Não foi possível apagar a anotação."
      );
    } finally {
      setDeletingSessionId(null);
    }
  }

  function handleStartEditSession(sessionId: string, content: string) {
    setEditingSessionId(sessionId);
    setEditContent(content);
  }

  function handleCancelEditSession() {
    setEditingSessionId(null);
    setEditContent("");
  }

  async function handleSaveEditSession() {
    if (!editingSessionId) return;
    const content = editContent.trim();
    if (!content) return;
    setSavingEdit(true);
    try {
      const supabase = createClient();
      const updated = await updateSessionNote(supabase, editingSessionId, content);
      setPatient((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.map((s) => (s.id === updated.id ? updated : s)),
            }
          : prev
      );
      setEditingSessionId(null);
      setEditContent("");
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Não foi possível salvar a edição."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  const sortedSessions = [...patient.sessions].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/pacientes"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para pacientes
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Excluindo..." : "Excluir paciente"}
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {deleteError}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl}
              alt={profile.name}
              className="h-full w-full object-cover"
            />
          ) : (
            profile.name
              .split(" ")
              .filter((w) => !["Dr.", "Dra."].includes(w))
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
          )}
        </div>
        <p className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {profile.name}
          </span>{" "}
          · {profile.title} · {profile.crp}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {patient.tipo === "individuo" ? (
            patient.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
          ) : (
            <Users className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {patient.name}
            </h1>
            {patient.tipo !== "individuo" && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {TIPO_FICHA_LABELS[patient.tipo]}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {patient.sessions.length} sessão(ões) registrada(s)
            </p>
            <ComplexidadeBar nivel={patient.complexidade} />
          </div>
        </div>
      </div>

      {patient.tipo !== "individuo" && patient.participantes.length > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Participantes ({patient.participantes.length})
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {patient.participantes.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {p.nome}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {[p.telefone, p.email].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
            Editar participantes: use &quot;Editar&quot; no topo da ficha.
          </p>
        </div>
      )}

      <div className="mt-6 inline-flex flex-wrap rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {(
          [
            "dados",
            "evolucao",
            "humor",
            "rastreio",
            "materiais",
            "documentos",
          ] as const
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-brand-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "dados" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoCard icon={CreditCard} label="CPF" value={patient.cpf || "—"} />
          <InfoCard icon={Phone} label="Telefone" value={patient.phone || "—"} />
          <InfoCard icon={Mail} label="E-mail" value={patient.email || "—"} />
          <InfoCard
            icon={Cake}
            label="Data de nascimento"
            value={patient.birthDate ? formatDateShort(patient.birthDate) : "—"}
          />
          <InfoCard
            icon={CalendarCheck}
            label="Data da primeira consulta"
            value={
              patient.firstAppointmentDate
                ? formatDateShort(patient.firstAppointmentDate)
                : "—"
            }
          />
          <div className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                <HeartPulse className="h-4 w-4" />
                Plano de saúde
              </div>
              <span
                className={
                  patient.hasInsurance
                    ? "text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-xs font-semibold text-rose-600 dark:text-rose-400"
                }
              >
                {patient.hasInsurance ? "Sim" : "Não"}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-zinc-900 dark:text-white">
              {patient.hasInsurance ? patient.insuranceName || "—" : "—"}
            </p>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-950 dark:bg-amber-950/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              Contato de emergência
            </div>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
              {patient.emergencyContact.name || "—"} · {patient.emergencyContact.phone || "—"}
            </p>
          </div>

          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Dados Adicionais
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoCard
                icon={GraduationCap}
                label="Escolaridade"
                value={patient.escolaridade || "—"}
              />
              <InfoCard
                icon={HelpCircle}
                label="Por onde conheceu o profissional"
                value={patient.comoConheceu || "—"}
              />
              <div className="sm:col-span-2 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                  <StickyNote className="h-4 w-4" />
                  Observações, medicamentos, tratamentos
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium text-zinc-900 dark:text-white">
                  {patient.observacoes || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "evolucao" && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setTranscribeOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-left transition-colors hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/40 dark:hover:bg-brand-950/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <Mic className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand-900 dark:text-brand-200">
                Transcrever sessão
              </span>
              <span className="block text-xs text-brand-700/80 dark:text-brand-300/70">
                Grave o atendimento e gere a anotação automaticamente. O áudio
                não é armazenado.
              </span>
            </span>
          </button>

          <form
            onSubmit={handleAddNote}
            className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Lock className="h-4 w-4 text-zinc-400" />
              Nova anotação sigilosa
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Registre a evolução da sessão..."
              className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                Data e hora serão registradas automaticamente.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Salvando..." : "Salvar anotação"}
              </button>
            </div>
          </form>

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
                      <span className="ml-1 inline-flex" title="Anotação sigilosa">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                      {session.origem === "transcricao" && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          <Mic className="h-3 w-3" />
                          Transcrição da sessão
                        </span>
                      )}
                      {session.updatedAt !== session.dateTime && (
                        <span
                          className="ml-1"
                          title={`Editado em ${formatDateTime(session.updatedAt)}`}
                        >
                          (editado)
                        </span>
                      )}
                    </div>
                    {editingSessionId !== session.id && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleStartEditSession(session.id, session.content)
                          }
                          aria-label="Editar anotação"
                          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(session.id)}
                          disabled={deletingSessionId === session.id}
                          aria-label="Apagar anotação"
                          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingSessionId === session.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                        autoFocus
                        className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelEditSession}
                          className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEditSession}
                          disabled={savingEdit || !editContent.trim()}
                          className="rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingEdit ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {session.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "humor" && (
        <PatientMoodTab
          patient={patient}
          onUnlinked={() =>
            setPatient((prev) => (prev ? { ...prev, clienteUserId: null } : prev))
          }
        />
      )}

      {tab === "rastreio" && (
        <div className="mt-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Respostas de escalas de rastreio enviadas por link vinculado a esta
            ficha. Para gerar um link, vá em Meu Link e escolha &quot;Paciente
            cadastrado&quot;. São instrumentos de triagem, não de diagnóstico.
          </p>
          <div className="mt-4">
            <RespostasEscalaList pacienteId={patient.id} />
          </div>
        </div>
      )}

      {tab === "materiais" && (
        <PatientMaterialsTab
          pacienteId={patient.id}
          temConta={Boolean(patient.clienteUserId)}
        />
      )}

      {tab === "documentos" && <PatientDocumentsTab patient={patient} />}

      {transcribeOpen && patient && (
        <SessionTranscriptionModal
          patientName={patient.name}
          onClose={() => setTranscribeOpen(false)}
          onSave={async ({ texto, duracaoSegundos, consentimentoEm }) => {
            const supabase = createClient();
            const newNote = await addSessionNote(supabase, patient.id, texto, {
              origem: "transcricao",
              consentimentoEm,
              duracaoSegundos,
            });
            setPatient((prev) =>
              prev ? { ...prev, sessions: [newNote, ...prev.sessions] } : prev
            );
            setTranscribeOpen(false);
          }}
        />
      )}

      {editOpen && patient && (
        <PatientFormModal
          title="Editar Paciente"
          submitLabel="Salvar Alterações"
          initialValues={patientToFormInput(patient)}
          onClose={() => setEditOpen(false)}
          onSave={(input) => updatePatient(createClient(), patient.id, input)}
          onSaved={(updated) => {
            setPatient((prev) =>
              prev ? { ...updated, sessions: prev.sessions } : updated
            );
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-1.5 text-sm font-medium text-zinc-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
