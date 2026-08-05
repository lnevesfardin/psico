import type { SupabaseClient } from "@supabase/supabase-js";

export type MoodSharing = {
  pacienteId: string;
  psicologoId: string;
  psicologoNome: string;
};

type SharingRow = {
  paciente_id: string;
  psicologo_id: string;
  psicologo_nome: string;
};

/**
 * Com quem o cliente logado está compartilhando o check-in de humor —
 * espelha pacientes.cliente_user_id (ver vincular_paciente_cliente no
 * schema.sql), que só o psicólogo cria/desfaz, mas é o humor do cliente que
 * está em jogo, então ele precisa ver e poder controlar esse vínculo.
 */
export async function listMoodSharing(
  supabase: SupabaseClient
): Promise<MoodSharing[]> {
  const { data, error } = await supabase.rpc("meus_compartilhamentos_humor");
  if (error) throw new Error(error.message);
  return (data as SharingRow[]).map((row) => ({
    pacienteId: row.paciente_id,
    psicologoId: row.psicologo_id,
    psicologoNome: row.psicologo_nome,
  }));
}

/**
 * Desfaz o vínculo e registra um aviso in-app pro psicólogo (ver
 * avisos_psicologo/parar_compartilhar_humor no schema.sql) — a função já
 * confere que o vínculo pertence a auth.uid(), então dá pra chamar direto
 * daqui, sem rota intermediária.
 */
export async function stopSharingMood(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<void> {
  const { error } = await supabase.rpc("parar_compartilhar_humor", {
    p_paciente_id: pacienteId,
  });
  if (error) throw new Error(error.message);
}
