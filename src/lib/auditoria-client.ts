import type { SupabaseClient } from "@supabase/supabase-js";

export type AcaoAuditoria =
  | "leu_evolucao"
  | "assinou_evolucao"
  | "exportou_prontuario"
  | "emitiu_recibo"
  | "emitiu_documento"
  | "uso_ia";

export const ACAO_LABEL: Record<AcaoAuditoria, string> = {
  leu_evolucao: "Leu evolução",
  assinou_evolucao: "Assinou evolução",
  exportou_prontuario: "Exportou prontuário",
  emitiu_recibo: "Emitiu recibo",
  emitiu_documento: "Emitiu documento",
  uso_ia: "Usou recurso de IA",
};

export type RegistroAuditoria = {
  id: number;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  pacienteId: string | null;
  pacienteNome: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type AuditLogRow = {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  paciente_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const COLUMNS = "id, acao, entidade, entidade_id, paciente_id, ip, user_agent, created_at";

// audit_log.paciente_id não tem FK declarada pra "pacientes" (a tabela
// também recebe entradas sem paciente, ex.: uso_ia genérico) — por isso o
// nome é resolvido numa segunda consulta em vez de um select aninhado.
export async function listAuditoria(
  supabase: SupabaseClient,
  filtro: { pacienteId?: string; limit?: number } = {}
): Promise<RegistroAuditoria[]> {
  let query = supabase
    .from("audit_log")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(filtro.limit ?? 100);
  if (filtro.pacienteId) {
    query = query.eq("paciente_id", filtro.pacienteId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data as AuditLogRow[];

  const pacienteIds = Array.from(new Set(rows.map((r) => r.paciente_id).filter((id): id is string => !!id)));
  let nomes = new Map<string, string>();
  if (pacienteIds.length > 0) {
    const { data: pacientes } = await supabase.from("pacientes").select("id, nome").in("id", pacienteIds);
    nomes = new Map((pacientes ?? []).map((p) => [p.id as string, p.nome as string]));
  }

  return rows.map((r) => ({
    id: r.id,
    acao: r.acao,
    entidade: r.entidade,
    entidadeId: r.entidade_id,
    pacienteId: r.paciente_id,
    pacienteNome: r.paciente_id ? (nomes.get(r.paciente_id) ?? null) : null,
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  }));
}
