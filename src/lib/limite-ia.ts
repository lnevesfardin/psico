import type { SupabaseClient } from "@supabase/supabase-js";

export type RecursoIA = "chat" | "lancamento" | "transcricao";

/**
 * Freio das rotas que chamam o Gemini — as únicas em que cada requisição sai
 * do bolso. Os tetos ficam no banco (checar_limite_ia no schema.sql), não
 * aqui: a chave é montada lá a partir de auth.uid(), pra ninguém escolher
 * chave nem limite pelo lado do cliente.
 *
 * Em caso de erro na checagem, libera a chamada em vez de bloquear: um
 * problema no freio não pode derrubar a transcrição de uma sessão em curso.
 */
export async function dentroDoLimiteIA(
  supabase: SupabaseClient,
  recurso: RecursoIA
): Promise<boolean> {
  const { data, error } = await supabase.rpc("checar_limite_ia", {
    p_recurso: recurso,
  });
  if (error) return true;
  return data !== false;
}

export const MENSAGEM_LIMITE_IA =
  "Você fez muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.";
