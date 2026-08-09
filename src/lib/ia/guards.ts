import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUserRole } from "@/lib/auth/role";

// Server-only: usado só pelos route handlers de src/app/api/gemini/*. Nunca
// importar de um Client Component — as checagens aqui são a trava de
// verdade (o client não pode decidir sozinho que tem permissão pra usar IA).

export type IAGuardError = { status: number; error: string };
export type IAGuardOk = { userId: string; orgId: string };

export function isIAGuardError(value: IAGuardOk | IAGuardError): value is IAGuardError {
  return "error" in value;
}

// Usado tanto pelas 4 rotas novas (via autorizarUsoIA abaixo) quanto pelas
// rotas de IA que já existiam antes deste módulo (chat assistente, extração
// de lançamento, transcrição de sessão) — "desligar a IA por completo" na
// tela de configuração da org precisa valer pra toda chamada ao modelo, não
// só pras 4 funcionalidades novas.
export async function verificarIaAtivaNaOrg(
  supabase: SupabaseClient,
  userId: string
): Promise<IAGuardError | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();
  const orgId = (profile?.org_id as string | null) ?? null;
  if (!orgId) {
    return { status: 403, error: "Não autorizado." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("ia_ativa")
    .eq("id", orgId)
    .single();
  if (!org?.ia_ativa) {
    return {
      status: 403,
      error:
        "A inteligência artificial está desativada para esta organização. Reative em Meu Perfil > Inteligência artificial.",
    };
  }
  return null;
}

// Reúne as 3 travas obrigatórias do módulo de IA, nesta ordem: usuário
// autenticado como psicólogo (só ele tem prontuário — secretaria/
// admin_clinica ainda não têm UI própria, ver Fase 0), IA ligada na própria
// organização (organizations.ia_ativa) e consentimento 'processamento_ia'
// ativo daquele paciente especificamente. Qualquer uma que falhe bloqueia a
// chamada ao modelo — nenhuma funcionalidade de IA roda sem as três.
export async function autorizarUsoIA(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<IAGuardOk | IAGuardError> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 401, error: "Não autenticado." };
  }

  const role = await fetchUserRole(supabase, user.id);
  if (role !== "psicologo") {
    return { status: 403, error: "Não autorizado." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  const orgId = (profile?.org_id as string | null) ?? null;
  if (!orgId) {
    return { status: 403, error: "Não autorizado." };
  }

  const iaError = await verificarIaAtivaNaOrg(supabase, user.id);
  if (iaError) return iaError;

  const { data: consentimento } = await supabase
    .from("consentimentos")
    .select("id")
    .eq("paciente_id", pacienteId)
    .eq("tipo", "processamento_ia")
    .eq("aceito", true)
    .is("revogado_em", null)
    .limit(1)
    .maybeSingle();
  if (!consentimento) {
    return {
      status: 403,
      error:
        "Este paciente ainda não tem consentimento ativo para uso de inteligência artificial. Peça para ele aceitar o termo pelo portal do paciente (Meus Agendamentos > Consentimentos) antes de usar recursos de IA nos dados dele.",
    };
  }

  return { userId: user.id, orgId };
}

// Loga 'uso_ia' em audit_log com IP/user agent de verdade (só disponíveis
// aqui, num route handler com Request — ver o mesmo padrão em
// api/consentimentos/aceitar/route.ts). Falha de log nunca derruba a
// resposta ao usuário: é auditoria, não uma trava de acesso.
export async function registrarUsoIA(
  supabase: SupabaseClient,
  request: Request,
  input: { entidade: string; entidadeId?: string | null; pacienteId: string }
): Promise<void> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;
  try {
    await supabase.rpc("registrar_auditoria", {
      p_acao: "uso_ia",
      p_entidade: input.entidade,
      p_entidade_id: input.entidadeId ?? null,
      p_paciente_id: input.pacienteId,
      p_ip: ip,
      p_user_agent: userAgent,
    });
  } catch {
    // ver comentário acima — auditoria não bloqueia a funcionalidade
  }
}
