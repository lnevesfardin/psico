import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role key: ignora RLS de propósito, porque o
 * despachante de lembretes precisa ler consultas e perfis de TODOS os
 * psicólogos — não existe um usuário logado no contexto do cron.
 *
 * NUNCA importar isto de um Client Component: a service role key dá acesso
 * irrestrito ao banco e não pode ir para o bundle do navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_URL) não configurada no ambiente do servidor."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
