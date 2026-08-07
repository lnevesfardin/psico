import type { SupabaseClient } from "@supabase/supabase-js";
import type { EscalaSlug } from "@/lib/escalas";

export type RespostaEscala = {
  id: string;
  escala: EscalaSlug;
  pacienteNome: string | null;
  respostas: Record<string, unknown>;
  createdAt: string;
};

type RespostaRow = {
  id: string;
  escala: string;
  paciente_nome: string | null;
  respostas: Record<string, unknown>;
  created_at: string;
};

function rowToResposta(row: RespostaRow): RespostaEscala {
  return {
    id: row.id,
    escala: row.escala as EscalaSlug,
    pacienteNome: row.paciente_nome,
    respostas: row.respostas,
    createdAt: row.created_at,
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
  }
): Promise<void> {
  const { error } = await supabase.rpc("responder_escala_publico", {
    p_psicologo_id: input.psicologoId,
    p_escala: input.escala,
    p_paciente_nome: input.pacienteNome,
    p_respostas: input.respostas,
  });
  if (error) throw new Error(error.message);
}

export async function listRespostasEscala(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<RespostaEscala[]> {
  const { data, error } = await supabase
    .from("respostas_escala")
    .select("id, escala, paciente_nome, respostas, created_at")
    .eq("psicologo_id", psicologoId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RespostaRow[]).map(rowToResposta);
}

export async function apagarRespostaEscala(
  supabase: SupabaseClient,
  respostaId: string
): Promise<void> {
  const { error } = await supabase
    .from("respostas_escala")
    .delete()
    .eq("id", respostaId);
  if (error) throw new Error(error.message);
}
