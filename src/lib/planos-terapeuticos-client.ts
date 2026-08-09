import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanoStatus = "ativo" | "concluido" | "pausado";

export type Plano = {
  id: string;
  patientId: string;
  abordagem: string | null;
  hipoteseDiagnostica: string | null;
  objetivoGeral: string | null;
  status: PlanoStatus;
  revisarEm: string | null; // yyyy-mm-dd
  createdAt: string;
  updatedAt: string;
};

type PlanoRow = {
  id: string;
  paciente_id: string;
  abordagem: string | null;
  hipotese_diagnostica: string | null;
  objetivo_geral: string | null;
  status: PlanoStatus;
  revisar_em: string | null;
  created_at: string;
  updated_at: string;
};

const PLANO_COLUMNS =
  "id, paciente_id, abordagem, hipotese_diagnostica, objetivo_geral, status, revisar_em, created_at, updated_at";

function rowToPlano(row: PlanoRow): Plano {
  return {
    id: row.id,
    patientId: row.paciente_id,
    abordagem: row.abordagem,
    hipoteseDiagnostica: row.hipotese_diagnostica,
    objetivoGeral: row.objetivo_geral,
    status: row.status,
    revisarEm: row.revisar_em,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Mais recente primeiro — a UI mostra o do topo (normalmente 'ativo') em
// destaque e o resto como histórico (paciente pode ter mais de um plano ao
// longo do tratamento, ex.: reinício depois de uma pausa).
export async function listPlanos(supabase: SupabaseClient, patientId: string): Promise<Plano[]> {
  const { data, error } = await supabase
    .from("planos_terapeuticos")
    .select(PLANO_COLUMNS)
    .eq("paciente_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as PlanoRow[]).map(rowToPlano);
}

export type PlanoInput = {
  abordagem: string;
  hipoteseDiagnostica: string;
  objetivoGeral: string;
  revisarEm: string | null;
};

export async function createPlano(
  supabase: SupabaseClient,
  psicologoId: string,
  patientId: string,
  input: PlanoInput
): Promise<Plano> {
  const { data, error } = await supabase
    .from("planos_terapeuticos")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: patientId,
      abordagem: input.abordagem.trim() || null,
      hipotese_diagnostica: input.hipoteseDiagnostica.trim() || null,
      objetivo_geral: input.objetivoGeral.trim() || null,
      revisar_em: input.revisarEm,
    })
    .select(PLANO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPlano(data as PlanoRow);
}

export async function updatePlano(
  supabase: SupabaseClient,
  planoId: string,
  input: PlanoInput
): Promise<Plano> {
  const { data, error } = await supabase
    .from("planos_terapeuticos")
    .update({
      abordagem: input.abordagem.trim() || null,
      hipotese_diagnostica: input.hipoteseDiagnostica.trim() || null,
      objetivo_geral: input.objetivoGeral.trim() || null,
      revisar_em: input.revisarEm,
    })
    .eq("id", planoId)
    .select(PLANO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPlano(data as PlanoRow);
}

export async function updatePlanoStatus(
  supabase: SupabaseClient,
  planoId: string,
  status: PlanoStatus
): Promise<void> {
  const { error } = await supabase
    .from("planos_terapeuticos")
    .update({ status })
    .eq("id", planoId);
  if (error) throw new Error(error.message);
}

export type ObjetivoStatus = "em_andamento" | "concluido";

export type Objetivo = {
  id: string;
  planoId: string;
  descricao: string;
  indicador: string | null;
  ordem: number;
  status: ObjetivoStatus;
  concluidoEm: string | null;
  createdAt: string;
};

type ObjetivoRow = {
  id: string;
  plano_id: string;
  descricao: string;
  indicador: string | null;
  ordem: number;
  status: ObjetivoStatus;
  concluido_em: string | null;
  created_at: string;
};

const OBJETIVO_COLUMNS = "id, plano_id, descricao, indicador, ordem, status, concluido_em, created_at";

function rowToObjetivo(row: ObjetivoRow): Objetivo {
  return {
    id: row.id,
    planoId: row.plano_id,
    descricao: row.descricao,
    indicador: row.indicador,
    ordem: row.ordem,
    status: row.status,
    concluidoEm: row.concluido_em,
    createdAt: row.created_at,
  };
}

export async function listObjetivos(supabase: SupabaseClient, planoId: string): Promise<Objetivo[]> {
  const { data, error } = await supabase
    .from("objetivos_terapeuticos")
    .select(OBJETIVO_COLUMNS)
    .eq("plano_id", planoId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ObjetivoRow[]).map(rowToObjetivo);
}

// Usado no painel "Antes da sessão", que lista objetivos em aberto de
// qualquer plano ativo do paciente sem a tela já saber o plano_id de antemão.
export async function listObjetivosAbertosByPatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<Objetivo[]> {
  const { data, error } = await supabase
    .from("objetivos_terapeuticos")
    .select(`${OBJETIVO_COLUMNS}, planos_terapeuticos!inner(paciente_id, status)`)
    .eq("planos_terapeuticos.paciente_id", patientId)
    .eq("planos_terapeuticos.status", "ativo")
    .eq("status", "em_andamento")
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ObjetivoRow[]).map(rowToObjetivo);
}

export type ObjetivoInput = {
  descricao: string;
  indicador: string;
  ordem: number;
};

export async function createObjetivo(
  supabase: SupabaseClient,
  planoId: string,
  input: ObjetivoInput
): Promise<Objetivo> {
  const { data, error } = await supabase
    .from("objetivos_terapeuticos")
    .insert({
      plano_id: planoId,
      descricao: input.descricao.trim(),
      indicador: input.indicador.trim() || null,
      ordem: input.ordem,
    })
    .select(OBJETIVO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToObjetivo(data as ObjetivoRow);
}

export async function updateObjetivoStatus(
  supabase: SupabaseClient,
  objetivoId: string,
  status: ObjetivoStatus
): Promise<void> {
  const { error } = await supabase
    .from("objetivos_terapeuticos")
    .update({ status, concluido_em: status === "concluido" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", objetivoId);
  if (error) throw new Error(error.message);
}

// Sem deleteObjetivo de propósito: retenção de prontuário (Res. CFP 01/2009
// e 06/2019) — um objetivo indesejado se marca "concluído" via
// updateObjetivoStatus, nunca desaparece do histórico do que foi planejado.
// O banco já bloqueia o delete (ver policies em schema.sql); a função nem
// existe pra não sugerir um caminho que a RLS vai rejeitar.
