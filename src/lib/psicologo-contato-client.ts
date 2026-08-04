import type { SupabaseClient } from "@supabase/supabase-js";

export type MeuPsicologoContato = {
  psicologoId: string;
  nome: string;
  whatsapp: string;
} | null;

// Usado só pelo botão de emergência do check-in de humor (abrir WhatsApp do
// psicólogo). "Meu psicólogo" aqui é resolvido pela consulta mais recente
// do cliente (RPC meu_psicologo_contato), não pelo vínculo
// pacientes.cliente_user_id — esse vínculo é no sentido psicólogo→paciente
// e o cliente pode nem saber que foi vinculado.
export async function fetchMeuPsicologoContato(
  supabase: SupabaseClient
): Promise<MeuPsicologoContato> {
  const { data, error } = await supabase.rpc("meu_psicologo_contato").maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { psicologo_id: string; nome: string; whatsapp: string | null } | null;
  if (!row || !row.whatsapp) return null;
  return { psicologoId: row.psicologo_id, nome: row.nome, whatsapp: row.whatsapp };
}
