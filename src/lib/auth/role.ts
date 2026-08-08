import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "psicologo" | "secretaria" | "admin_clinica" | "paciente";

export const DASHBOARD_PATH = "/dashboard/agenda";
export const CLIENT_AREA_PATH = "/agendamentos";

/**
 * Sem role definida, mantém o fallback histórico para psicólogo — cobre
 * contas criadas antes da coluna `profiles.role` existir, para não trancar
 * psicólogos existentes fora do próprio painel. `secretaria`/`admin_clinica`
 * também caem na área de staff (não têm sidebar própria ainda).
 */
export function dashboardPathForRole(role: Role | null | undefined): string {
  return role === "paciente" ? CLIENT_AREA_PATH : DASHBOARD_PATH;
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
