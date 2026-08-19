import type { SupabaseClient } from "@supabase/supabase-js";
import type { RespostaJogo } from "@/lib/jogos";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

/** Gera (ou reaproveita) o link daquele jogo para aquele paciente. */
export async function gerarConviteJogo(
  supabase: SupabaseClient,
  pacienteId: string,
  jogo: string
): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_convite_jogo", {
    p_paciente_id: pacienteId,
    p_jogo: jogo,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Chamada do jogo em si, que roda sem login (o paciente pode abrir o link
 * direto do WhatsApp). responder_jogo_publico é o único caminho de escrita
 * em respostas_jogo — ver schema.sql.
 */
export async function enviarRespostaJogo(
  supabase: SupabaseClient,
  token: string,
  respostas: RespostaJogo
): Promise<void> {
  const { error } = await supabase.rpc("responder_jogo_publico", {
    p_token: token,
    p_respostas: respostas,
  });
  if (error) throw new Error(error.message);
}

export type RespostaJogoRegistro = {
  id: string;
  jogo: string;
  respostas: RespostaJogo;
  createdAt: string;
};

type RespostaJogoRow = {
  id: string;
  jogo: string;
  respostas: RespostaJogo;
  created_at: string;
};

const COLUNAS = "id, jogo, respostas, created_at";

/** Respostas de jogos de um paciente, para a ficha dele. */
export async function listRespostasJogoPaciente(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<RespostaJogoRegistro[]> {
  const { data, error } = await supabase
    .from("respostas_jogo")
    .select(COLUNAS)
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data as RespostaJogoRow[]).map((row) => ({
    id: row.id,
    jogo: row.jogo,
    respostas: row.respostas,
    createdAt: row.created_at,
  }));
}

export async function apagarRespostaJogo(
  supabase: SupabaseClient,
  respostaId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("respostas_jogo")
    .delete()
    .eq("id", respostaId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A resposta da atividade");
}
