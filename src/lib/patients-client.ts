import type { SupabaseClient } from "@supabase/supabase-js";
import type { Patient, SessionNote } from "@/lib/dashboard-data";

type PacienteRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
};

const PACIENTE_COLUMNS =
  "id, nome, cpf, telefone, email, data_nascimento, contato_emergencia_nome, contato_emergencia_telefone";

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
    sessions,
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

  const { data: sessoes } = await supabase
    .from("sessoes_prontuario")
    .select("id, conteudo, data_hora")
    .eq("paciente_id", patientId)
    .order("data_hora", { ascending: false });

  const sessions: SessionNote[] = (sessoes ?? []).map((s) => ({
    id: s.id as string,
    content: s.conteudo as string,
    dateTime: s.data_hora as string,
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
    })
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data as PacienteRow);
}

export async function deletePatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { error } = await supabase.from("pacientes").delete().eq("id", patientId);
  if (error) throw new Error(error.message);
}

export async function addSessionNote(
  supabase: SupabaseClient,
  patientId: string,
  content: string
): Promise<SessionNote> {
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .insert({ paciente_id: patientId, conteudo: content })
    .select("id, conteudo, data_hora")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    content: data.conteudo as string,
    dateTime: data.data_hora as string,
  };
}
