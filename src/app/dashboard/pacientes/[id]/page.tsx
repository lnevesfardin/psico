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
  Archive,
  ArchiveRestore,
  FileDown,
  Pencil,
  CalendarCheck,
  GraduationCap,
  HelpCircle,
  StickyNote,
  MapPin,
  UserRound,
  Wallet,
  ClipboardList,
} from "lucide-react";
import type { Patient, PatientStatus } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/client";
import {
  archivePatient,
  getPatientWithSessions,
  isMinor,
  patientToFormInput,
  unarchivePatient,
  updatePatient,
  updatePatientStatus,
} from "@/lib/patients-client";
import { PatientFormModal } from "@/components/patient-form-modal";
import { PatientMoodTab } from "@/components/dashboard/patient-mood-tab";
import { PatientMaterialsTab } from "@/components/dashboard/patient-materials-tab";
import { PatientAgendaTab } from "@/components/dashboard/patient-agenda-tab";
import { PatientFinanceiroTab } from "@/components/dashboard/patient-financeiro-tab";
import { PatientTarefasTab } from "@/components/dashboard/patient-tarefas-tab";
import { PatientEvolucaoTab } from "@/components/dashboard/patient-evolucao-tab";
import { PatientInstrumentosTab } from "@/components/dashboard/patient-instrumentos-tab";
import { PatientPlanoTab } from "@/components/dashboard/patient-plano-tab";
import { PatientAntesDaSessaoTab } from "@/components/dashboard/patient-antes-sessao-tab";
import { formatCurrency, formatDateShort, formatEndereco } from "@/lib/format";
import { useProfile } from "@/context/profile-context";

const STATUS_LABEL: Record<PatientStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  alta: "Alta",
  desistencia: "Desistência",
};

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
    | "resumo"
    | "evolucao"
    | "agenda"
    | "financeiro"
    | "tarefas"
    | "humor"
    | "materiais"
    | "instrumentos"
    | "plano"
    | "sessao"
  >(() => {
    // Link "Escrever evolução" da Agenda (após marcar uma consulta como
    // realizada) chega com ?tab=evolucao — lido direto de window.location
    // no initializer pra não exigir Suspense boundary (useSearchParams)
    // nem disparar setState num efeito.
    if (typeof window === "undefined") return "resumo";
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      requested === "resumo" ||
      requested === "evolucao" ||
      requested === "agenda" ||
      requested === "financeiro" ||
      requested === "tarefas" ||
      requested === "humor" ||
      requested === "materiais" ||
      requested === "instrumentos" ||
      requested === "plano" ||
      requested === "sessao"
    ) {
      return requested;
    }
    return "resumo";
  });
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

  async function handleArchive() {
    if (!patient) return;
    const confirmed = window.confirm(
      `Arquivar ${patient.name}? O prontuário continua guardado (exigência de retenção) e some só da lista de pacientes ativos — dá para reativar depois.`
    );
    if (!confirmed) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const supabase = createClient();
      await archivePatient(supabase, patient.id);
      router.push("/dashboard/pacientes");
      router.refresh();
    } catch {
      setArchiveError("Não foi possível arquivar o paciente.");
      setArchiving(false);
    }
  }

  async function handleUnarchive() {
    if (!patient) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const supabase = createClient();
      await unarchivePatient(supabase, patient.id);
      setPatient((prev) => (prev ? { ...prev, arquivadoEm: null } : prev));
    } catch {
      setArchiveError("Não foi possível reativar o paciente.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleStatusChange(status: PatientStatus) {
    if (!patient) return;
    const previous = patient.status;
    setPatient((prev) => (prev ? { ...prev, status } : prev));
    try {
      const supabase = createClient();
      await updatePatientStatus(supabase, patient.id, status);
    } catch {
      setPatient((prev) => (prev ? { ...prev, status: previous } : prev));
      window.alert("Não foi possível atualizar o status.");
    }
  }

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
          <Link
            href={`/dashboard/pacientes/${patient.id}/prontuario`}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <FileDown className="h-4 w-4" />
            Exportar prontuário
          </Link>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          {patient.arquivadoEm ? (
            <button
              type="button"
              onClick={handleUnarchive}
              disabled={archiving}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-400 dark:hover:bg-brand-950"
            >
              <ArchiveRestore className="h-4 w-4" />
              {archiving ? "Reativando..." : "Reativar paciente"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950"
            >
              <Archive className="h-4 w-4" />
              {archiving ? "Arquivando..." : "Arquivar paciente"}
            </button>
          )}
        </div>
      </div>

      {archiveError && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {archiveError}
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
          {patient.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {patient.nomeSocial || patient.name}
            </h1>
            {patient.arquivadoEm ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Arquivado
              </span>
            ) : (
              <select
                value={patient.status}
                onChange={(e) => handleStatusChange(e.target.value as PatientStatus)}
                className="rounded-full border-0 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 focus:outline-none dark:bg-brand-950 dark:text-brand-300"
              >
                {(Object.keys(STATUS_LABEL) as PatientStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </div>
          {patient.nomeSocial && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              Nome civil: {patient.name}
            </p>
          )}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {patient.sessions.length} sessão(ões) registrada(s)
          </p>
        </div>
      </div>

      <div className="mt-6 inline-flex flex-wrap rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {(
          [
            "resumo",
            "sessao",
            "evolucao",
            "agenda",
            "financeiro",
            "tarefas",
            "instrumentos",
            "plano",
            "humor",
            "materiais",
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
            {t === "resumo"
              ? "Resumo"
              : t === "sessao"
                ? "Antes da sessão"
                : t === "evolucao"
                  ? "Evolução / Prontuário"
                  : t === "agenda"
                    ? "Agenda"
                    : t === "financeiro"
                      ? "Financeiro"
                      : t === "tarefas"
                        ? "Tarefas"
                        : t === "instrumentos"
                          ? "Instrumentos"
                          : t === "plano"
                            ? "Plano terapêutico"
                            : t === "humor"
                              ? "Acompanhamento"
                              : "Materiais"}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoCard icon={CreditCard} label="CPF" value={patient.cpf || "—"} />
          <InfoCard icon={Phone} label="Telefone" value={patient.phone || "—"} />
          <InfoCard icon={Mail} label="E-mail" value={patient.email || "—"} />
          <InfoCard
            icon={Cake}
            label="Data de nascimento"
            value={
              patient.birthDate
                ? `${formatDateShort(patient.birthDate)} (${isMinor(patient.birthDate) ? "menor de idade" : "maior de idade"})`
                : "—"
            }
          />
          <InfoCard icon={UserRound} label="Gênero" value={patient.genero || "—"} />
          <InfoCard
            icon={CalendarCheck}
            label="Data da primeira consulta"
            value={
              patient.firstAppointmentDate
                ? formatDateShort(patient.firstAppointmentDate)
                : "—"
            }
          />
          {patient.endereco && (
            <InfoCard
              icon={MapPin}
              label="Endereço"
              value={formatEndereco(patient.endereco) || "—"}
            />
          )}
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

          {isMinor(patient.birthDate) && (
            <div className="sm:col-span-2 rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-950 dark:bg-amber-950/40">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                Responsável legal
              </div>
              <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
                {patient.responsavel.nome || "—"}
                {patient.responsavel.parentesco ? ` (${patient.responsavel.parentesco})` : ""}
                {patient.responsavel.cpf ? ` · CPF ${patient.responsavel.cpf}` : ""}
              </p>
            </div>
          )}

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
              <InfoCard
                icon={ClipboardList}
                label="Queixa inicial"
                value={patient.queixaInicial || "—"}
              />
              <InfoCard
                icon={HelpCircle}
                label="Encaminhado por"
                value={patient.encaminhadoPor || "—"}
              />
              <InfoCard
                icon={Wallet}
                label="Valor da sessão"
                value={patient.valorSessao != null ? formatCurrency(patient.valorSessao) : "—"}
              />
              <InfoCard
                icon={CalendarCheck}
                label="Frequência padrão"
                value={patient.frequenciaPadrao || "—"}
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
        <PatientEvolucaoTab
          patientId={patient.id}
          patientName={patient.name}
          initialSessions={patient.sessions}
          onSessionsChange={(sessions) =>
            setPatient((prev) => (prev ? { ...prev, sessions } : prev))
          }
        />
      )}

      {tab === "agenda" && <PatientAgendaTab patientId={patient.id} />}

      {tab === "financeiro" && <PatientFinanceiroTab patientId={patient.id} />}

      {tab === "tarefas" && <PatientTarefasTab patientId={patient.id} />}

      {tab === "instrumentos" && <PatientInstrumentosTab patientId={patient.id} />}

      {tab === "plano" && <PatientPlanoTab patientId={patient.id} />}

      {tab === "sessao" && <PatientAntesDaSessaoTab patient={patient} />}

      {tab === "humor" && (
        <PatientMoodTab
          patient={patient}
          onUnlinked={() =>
            setPatient((prev) => (prev ? { ...prev, clienteUserId: null } : prev))
          }
        />
      )}

      {tab === "materiais" && (
        <PatientMaterialsTab
          pacienteId={patient.id}
          temConta={Boolean(patient.clienteUserId)}
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
