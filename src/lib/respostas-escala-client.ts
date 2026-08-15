import type { SupabaseClient } from "@supabase/supabase-js";
import type { EscalaSlug } from "@/lib/escalas";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type RespostaEscala = {
  id: string;
  escala: EscalaSlug;
  pacienteNome: string | null;
  respostas: Record<string, unknown>;
  createdAt: string;
  /** Preenchido só quando a resposta veio de um link vinculado a uma ficha. */
  pacienteId: string | null;
};

type RespostaRow = {
  id: string;
  escala: string;
  paciente_nome: string | null;
  respostas: Record<string, unknown>;
  created_at: string;
  paciente_id: string | null;
};

const RESPOSTA_COLUMNS =
  "id, escala, paciente_nome, respostas, created_at, paciente_id";

function rowToResposta(row: RespostaRow): RespostaEscala {
  return {
    id: row.id,
    escala: row.escala as EscalaSlug,
    pacienteNome: row.paciente_nome,
    respostas: row.respostas,
    createdAt: row.created_at,
    pacienteId: row.paciente_id,
  };
}

/**
 * Chamada direto do formulário público (anon, sem login) — a função
 * responder_escala_publico (security definer, ver schema.sql) é o único
 * caminho de escrita em respostas_escala.
 */
export async function enviarRespostaEscala(
  supabase: SupabaseClient,
  input: {
    psicologoId: string;
    escala: EscalaSlug;
    pacienteNome: string;
    respostas: Record<string, unknown>;
    /** Vem do link vinculado a uma ficha; ausente no link genérico. */
    token?: string;
  }
): Promise<void> {
  const { error } = await supabase.rpc("responder_escala_publico", {
    p_psicologo_id: input.psicologoId,
    p_escala: input.escala,
    p_paciente_nome: input.pacienteNome,
    p_respostas: input.respostas,
    p_token: input.token ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Só respostas do link genérico ("qualquer pessoa"). As vinculadas a uma
 * ficha (paciente_id preenchido) aparecem só na aba Rastreio daquele
 * paciente (ver listRespostasEscalaPaciente) — mostrar nos dois lugares
 * duplicaria a mesma resposta na tela.
 */
export async function listRespostasEscala(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<RespostaEscala[]> {
  const { data, error } = await supabase
    .from("respostas_escala")
    .select(RESPOSTA_COLUMNS)
    .eq("psicologo_id", psicologoId)
    .is("paciente_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RespostaRow[]).map(rowToResposta);
}

/** Histórico de rastreio de uma ficha — só respostas vindas de link vinculado. */
export async function listRespostasEscalaPaciente(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<RespostaEscala[]> {
  const { data, error } = await supabase
    .from("respostas_escala")
    .select(RESPOSTA_COLUMNS)
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RespostaRow[]).map(rowToResposta);
}

/** Gera (ou reaproveita) o link daquela escala para aquele paciente. */
export async function gerarConviteEscala(
  supabase: SupabaseClient,
  pacienteId: string,
  escala: EscalaSlug
): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_convite_escala", {
    p_paciente_id: pacienteId,
    p_escala: escala,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function apagarRespostaEscala(
  supabase: SupabaseClient,
  respostaId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("respostas_escala")
    .delete()
    .eq("id", respostaId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A resposta da escala");
}
