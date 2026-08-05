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
 * A mutação (RPC + e-mail pro psicólogo) roda inteira em
 * /api/mood-sharing/parar — ver o comentário na rota sobre por que não é
 * uma chamada de RPC direta daqui.
 */
export async function stopSharingMood(pacienteId: string): Promise<void> {
  const res = await fetch("/api/mood-sharing/parar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pacienteId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Não foi possível parar de compartilhar.");
  }
}
