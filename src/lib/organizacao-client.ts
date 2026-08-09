import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfiguracaoNotificacoes = {
  ativo: boolean;
  lembrete1hAtivo: boolean;
  lembrete24hAtivo: boolean;
  mensagemExtra: string;
};

type ConfigRow = {
  ativo: boolean;
  lembrete_1h_ativo: boolean;
  lembrete_24h_ativo: boolean;
  mensagem_extra: string | null;
};

// getOrgId(supabase) primeiro: RLS de "organizations"/"configuracao_notificacoes"
// já restringe à própria org, mas o id em si (pra outras chamadas que
// precisam dele explícito) vem de profiles.org_id.
export async function getOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();
  return (data?.org_id as string | null) ?? null;
}

export async function getPrazoCancelamentoHoras(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("organizations")
    .select("prazo_cancelamento_horas")
    .single();
  if (error) throw new Error(error.message);
  return data.prazo_cancelamento_horas as number;
}

export async function updatePrazoCancelamentoHoras(
  supabase: SupabaseClient,
  orgId: string,
  horas: number
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ prazo_cancelamento_horas: horas })
    .eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function getConfiguracaoNotificacoes(
  supabase: SupabaseClient
): Promise<ConfiguracaoNotificacoes> {
  const { data, error } = await supabase
    .from("configuracao_notificacoes")
    .select("ativo, lembrete_1h_ativo, lembrete_24h_ativo, mensagem_extra")
    .single();
  if (error) throw new Error(error.message);
  const row = data as ConfigRow;
  return {
    ativo: row.ativo,
    lembrete1hAtivo: row.lembrete_1h_ativo,
    lembrete24hAtivo: row.lembrete_24h_ativo,
    mensagemExtra: row.mensagem_extra ?? "",
  };
}

export async function updateConfiguracaoNotificacoes(
  supabase: SupabaseClient,
  orgId: string,
  input: ConfiguracaoNotificacoes
): Promise<void> {
  const { error } = await supabase
    .from("configuracao_notificacoes")
    .update({
      ativo: input.ativo,
      lembrete_1h_ativo: input.lembrete1hAtivo,
      lembrete_24h_ativo: input.lembrete24hAtivo,
      mensagem_extra: input.mensagemExtra.trim() || null,
    })
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
}
