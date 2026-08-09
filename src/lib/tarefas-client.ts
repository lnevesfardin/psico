import type { SupabaseClient } from "@supabase/supabase-js";

export type Tarefa = {
  id: string;
  patientId: string;
  objetivoId: string | null;
  titulo: string;
  instrucoes: string | null;
  prazo: string | null; // yyyy-mm-dd
  concluidaEm: string | null; // ISO string
  respostaPaciente: string | null;
  createdAt: string;
};

type TarefaRow = {
  id: string;
  paciente_id: string;
  objetivo_id: string | null;
  titulo: string;
  instrucoes: string | null;
  prazo: string | null;
  concluida_em: string | null;
  resposta_paciente: string | null;
  created_at: string;
};

const COLUMNS =
  "id, paciente_id, objetivo_id, titulo, instrucoes, prazo, concluida_em, resposta_paciente, created_at";

function rowToTarefa(row: TarefaRow): Tarefa {
  return {
    id: row.id,
    patientId: row.paciente_id,
    objetivoId: row.objetivo_id,
    titulo: row.titulo,
    instrucoes: row.instrucoes,
    prazo: row.prazo,
    concluidaEm: row.concluida_em,
    respostaPaciente: row.resposta_paciente,
    createdAt: row.created_at,
  };
}

export async function listTarefasByPatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("tarefas_paciente")
    .select(COLUMNS)
    .eq("paciente_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TarefaRow[]).map(rowToTarefa);
}

// Portal do paciente: RLS (eh_meu_paciente) já restringe ao próprio, sem
// precisar saber o próprio paciente_id de antemão.
export async function listMinhasTarefas(supabase: SupabaseClient): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("tarefas_paciente")
    .select(COLUMNS)
    .order("prazo", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data as TarefaRow[]).map(rowToTarefa);
}

export type NewTarefaInput = {
  patientId: string;
  objetivoId: string | null;
  titulo: string;
  instrucoes: string;
  prazo: string | null;
};

export async function createTarefa(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NewTarefaInput
): Promise<Tarefa> {
  const { data, error } = await supabase
    .from("tarefas_paciente")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      objetivo_id: input.objetivoId,
      titulo: input.titulo,
      instrucoes: input.instrucoes || null,
      prazo: input.prazo,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToTarefa(data as TarefaRow);
}

// Chamado pelo paciente: responde e/ou marca como concluída. Só essas duas
// colunas — a RLS permite update em qualquer coluna, mas a UI nunca deixa o
// paciente mexer em título/instruções (são do psicólogo).
export async function responderTarefa(
  supabase: SupabaseClient,
  tarefaId: string,
  input: { respostaPaciente: string; concluida: boolean }
): Promise<void> {
  const { error } = await supabase
    .from("tarefas_paciente")
    .update({
      resposta_paciente: input.respostaPaciente || null,
      concluida_em: input.concluida ? new Date().toISOString() : null,
    })
    .eq("id", tarefaId);
  if (error) throw new Error(error.message);
}

export async function deleteTarefa(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tarefas_paciente").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
