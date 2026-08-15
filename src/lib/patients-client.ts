import type { SupabaseClient } from "@supabase/supabase-js";
import type { Patient, SessionNote } from "@/lib/dashboard-data";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

type PacienteRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  tem_plano_saude: boolean;
  plano_saude_nome: string | null;
  data_primeira_consulta: string | null;
  escolaridade: string | null;
  como_conheceu: string | null;
  observacoes: string | null;
  cliente_user_id: string | null;
};

const PACIENTE_COLUMNS =
  "id, nome, cpf, telefone, email, data_nascimento, contato_emergencia_nome, contato_emergencia_telefone, tem_plano_saude, plano_saude_nome, data_primeira_consulta, escolaridade, como_conheceu, observacoes, cliente_user_id";

function rowToPatient(row: PacienteRow, sessions: SessionNote[] = []): Patient {
  return {
    id: row.id,
    name: row.nome,
    cpf: row.cpf ?? "",
    phone: row.telefone ?? "",
    email: row.email ?? "",
    birthDate: row.data_nascimento ?? "",
    emergencyContact: {
      name: row.contato_emergencia_nome ?? "",
      phone: row.contato_emergencia_telefone ?? "",
    },
    hasInsurance: row.tem_plano_saude,
    insuranceName: row.plano_saude_nome ?? "",
    firstAppointmentDate: row.data_primeira_consulta ?? "",
    escolaridade: row.escolaridade ?? "",
    comoConheceu: row.como_conheceu ?? "",
    observacoes: row.observacoes ?? "",
    sessions,
    clienteUserId: row.cliente_user_id,
  };
}

export async function listPatients(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("pacientes")
    .select(PACIENTE_COLUMNS)
    .eq("psicologo_id", psicologoId)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data as PacienteRow[]).map((row) => rowToPatient(row));
}

/**
 * Trilha de auditoria (LGPD, ver acessos_prontuario no schema.sql):
 * registra a abertura do prontuário. Fire-and-forget de propósito — falha
 * ao gravar o log (ex.: schema.sql ainda não atualizado) não pode impedir
 * o atendimento.
 */
async function registrarAcessoProntuario(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("acessos_prontuario")
    .insert({ psicologo_id: user.id, paciente_id: patientId });
}

export async function getPatientWithSessions(
  supabase: SupabaseClient,
  patientId: string
): Promise<Patient | null> {
  const { data: paciente, error } = await supabase
    .from("pacientes")
    .select(PACIENTE_COLUMNS)
    .eq("id", patientId)
    .single();
  if (error || !paciente) return null;

  registrarAcessoProntuario(supabase, patientId).catch(() => {});

  const { data: sessoes } = await supabase
    .from("sessoes_prontuario")
    .select("id, conteudo, data_hora, origem, updated_at")
    .eq("paciente_id", patientId)
    .order("data_hora", { ascending: false });

  const sessions: SessionNote[] = (sessoes ?? []).map((s) => ({
    id: s.id as string,
    content: s.conteudo as string,
    dateTime: s.data_hora as string,
    origem: (s.origem as SessionNote["origem"]) ?? "manual",
    updatedAt: (s.updated_at as string) ?? (s.data_hora as string),
  }));

  return rowToPatient(paciente as PacienteRow, sessions);
}

export type NewPatientInput = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  hasInsurance: boolean;
  insuranceName: string;
  firstAppointmentDate: string;
  escolaridade: string;
  comoConheceu: string;
  observacoes: string;
};

export async function createPatient(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NewPatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      psicologo_id: psicologoId,
      nome: input.name,
      cpf: input.cpf || null,
      telefone: input.phone || null,
      email: input.email || null,
      data_nascimento: input.birthDate || null,
      contato_emergencia_nome: input.emergencyContactName || null,
      contato_emergencia_telefone: input.emergencyContactPhone || null,
      tem_plano_saude: input.hasInsurance,
      plano_saude_nome: input.hasInsurance ? input.insuranceName || null : null,
      data_primeira_consulta: input.firstAppointmentDate || null,
      escolaridade: input.escolaridade || null,
      como_conheceu: input.comoConheceu || null,
      observacoes: input.observacoes || null,
    })
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data as PacienteRow);
}

export async function updatePatient(
  supabase: SupabaseClient,
  patientId: string,
  input: NewPatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("pacientes")
    .update({
      nome: input.name,
      cpf: input.cpf || null,
      telefone: input.phone || null,
      email: input.email || null,
      data_nascimento: input.birthDate || null,
      contato_emergencia_nome: input.emergencyContactName || null,
      contato_emergencia_telefone: input.emergencyContactPhone || null,
      tem_plano_saude: input.hasInsurance,
      plano_saude_nome: input.hasInsurance ? input.insuranceName || null : null,
      data_primeira_consulta: input.firstAppointmentDate || null,
      escolaridade: input.escolaridade || null,
      como_conheceu: input.comoConheceu || null,
      observacoes: input.observacoes || null,
    })
    .eq("id", patientId)
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data as PacienteRow);
}

export function patientToFormInput(patient: Patient): NewPatientInput {
  return {
    name: patient.name,
    cpf: patient.cpf,
    phone: patient.phone,
    email: patient.email,
    birthDate: patient.birthDate,
    emergencyContactName: patient.emergencyContact.name,
    emergencyContactPhone: patient.emergencyContact.phone,
    hasInsurance: patient.hasInsurance,
    insuranceName: patient.insuranceName,
    firstAppointmentDate: patient.firstAppointmentDate,
    escolaridade: patient.escolaridade,
    comoConheceu: patient.comoConheceu,
    observacoes: patient.observacoes,
  };
}

export async function deletePatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("pacientes")
    .delete()
    .eq("id", patientId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "O paciente");
}

export async function unlinkPatientFromClient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("pacientes")
    .update({ cliente_user_id: null })
    .eq("id", patientId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A desvinculação da conta do paciente");
}

export type SessionNoteOrigin =
  | { origem: "manual" }
  // consentimentoEm é a trilha de auditoria exigida para gravar áudio de
  // sessão (dado sensível de saúde, LGPD art. 11) — ver o modal de
  // transcrição, que só libera a gravação depois da confirmação.
  | {
      origem: "transcricao";
      consentimentoEm: string;
      duracaoSegundos: number;
    };

export async function addSessionNote(
  supabase: SupabaseClient,
  patientId: string,
  content: string,
  origin: SessionNoteOrigin = { origem: "manual" }
): Promise<SessionNote> {
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .insert({
      paciente_id: patientId,
      conteudo: content,
      origem: origin.origem,
      ...(origin.origem === "transcricao"
        ? {
            consentimento_em: origin.consentimentoEm,
            duracao_segundos: origin.duracaoSegundos,
          }
        : {}),
    })
    .select("id, conteudo, data_hora, origem, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    content: data.conteudo as string,
    dateTime: data.data_hora as string,
    origem: (data.origem as SessionNote["origem"]) ?? "manual",
    updatedAt: (data.updated_at as string) ?? (data.data_hora as string),
  };
}

export async function updateSessionNote(
  supabase: SupabaseClient,
  sessionId: string,
  content: string
): Promise<SessionNote> {
  // .select() depois do update, mesmo motivo de deleteSessionNote: sem isso
  // um update bloqueado pela RLS (schema ainda não atualizado, ou tentativa
  // de editar anotação de paciente de outro psicólogo) retornaria sucesso
  // com zero linhas afetadas, e a UI acharia que salvou sem ter salvo.
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .update({ conteudo: content })
    .eq("id", sessionId)
    .select("id, conteudo, data_hora, origem, updated_at");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "A anotação não foi salva no banco de dados. Confirme se o schema.sql mais recente foi executado no SQL Editor do Supabase."
    );
  }
  const row = data[0];
  return {
    id: row.id as string,
    content: row.conteudo as string,
    dateTime: row.data_hora as string,
    origem: (row.origem as SessionNote["origem"]) ?? "manual",
    updatedAt: row.updated_at as string,
  };
}

export async function deleteSessionNote(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  // .select() depois do delete força o Postgres a devolver as linhas
  // realmente apagadas — sem isso, um delete bloqueado pela RLS (ex.: schema
  // ainda não atualizado no Supabase) retorna sucesso com zero linhas
  // afetadas, e a UI achava que tinha apagado sem ter apagado (mesmo padrão
  // de deleteAppointment em appointments-context.tsx).
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .delete()
    .eq("id", sessionId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "A anotação não foi apagada no banco de dados. Confirme se o schema.sql mais recente foi executado no SQL Editor do Supabase."
    );
  }
}
