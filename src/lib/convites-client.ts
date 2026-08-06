import type { SupabaseClient } from "@supabase/supabase-js";

export type ConviteInfo = {
  pacientePrimeiroNome: string;
  psicologoNome: string;
  jaAceito: boolean;
};

type ConviteInfoRow = {
  paciente_primeiro_nome: string;
  psicologo_nome: string;
  ja_aceito: boolean;
};

/** Dados públicos do convite (token inválido devolve null). */
export async function fetchConviteInfo(
  supabase: SupabaseClient,
  token: string
): Promise<ConviteInfo | null> {
  const { data, error } = await supabase
    .rpc("convite_info", { p_token: token })
    .maybeSingle<ConviteInfoRow>();
  if (error || !data) return null;
  return {
    pacientePrimeiroNome: data.paciente_primeiro_nome,
    psicologoNome: data.psicologo_nome,
    jaAceito: data.ja_aceito,
  };
}

/** Amarra a conta recém-criada (já logada) à ficha do paciente. */
export async function aceitarConvite(
  supabase: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await supabase.rpc("aceitar_convite_paciente", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
}

/** Gera (ou reaproveita) o convite pendente do paciente e devolve o token. */
export async function gerarConvitePaciente(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_convite_paciente", {
    p_paciente_id: pacienteId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
