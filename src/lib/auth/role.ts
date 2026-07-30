import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "client" | "psychologist";

export const DASHBOARD_PATH = "/dashboard/agenda";
export const CLIENT_AREA_PATH = "/agendamentos";

/**
 * Sem role definida, mantém o fallback histórico para psicólogo — cobre
 * contas criadas antes da coluna `profiles.role` existir, para não trancar
 * psicólogos existentes fora do próprio painel.
 */
export function dashboardPathForRole(role: Role | null | undefined): string {
  return role === "client" ? CLIENT_AREA_PATH : DASHBOARD_PATH;
}

export async function fetchUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<Role | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return (data?.role as Role | null | undefined) ?? null;
}
