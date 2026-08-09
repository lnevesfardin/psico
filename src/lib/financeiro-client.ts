import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CategoriaLancamento,
  FormaPagamento,
  PaymentStatus,
  TipoLancamento,
} from "@/lib/dashboard-data";

export type Lancamento = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  valor: number;
  status: PaymentStatus;
  tipo: TipoLancamento;
  categoria: CategoriaLancamento;
  data: string; // yyyy-mm-dd
  vencimento: string; // yyyy-mm-dd
  pagoEm: string | null;
  formaPagamento: FormaPagamento | null;
  agendamentoId: string | null;
  pacoteId: string | null;
  descricao: string | null;
};

export type LancamentoRow = {
  id: string;
  paciente_id: string | null;
  paciente_nome: string | null;
  valor: number;
  status_pagamento: PaymentStatus;
  tipo: TipoLancamento;
  categoria: CategoriaLancamento;
  data: string;
  vencimento: string;
  pago_em: string | null;
  forma_pagamento: FormaPagamento | null;
  agendamento_id: string | null;
  pacote_id: string | null;
  descricao: string | null;
};

const COLUMNS =
  "id, paciente_id, paciente_nome, valor, status_pagamento, tipo, categoria, data, vencimento, pago_em, forma_pagamento, agendamento_id, pacote_id, descricao";

export function rowToLancamento(row: LancamentoRow): Lancamento {
  return {
    id: row.id,
    patientId: row.paciente_id,
    patientName: row.paciente_nome,
    valor: row.valor,
    status: row.status_pagamento,
    tipo: row.tipo,
    categoria: row.categoria,
    data: row.data,
    vencimento: row.vencimento,
    pagoEm: row.pago_em,
    formaPagamento: row.forma_pagamento,
    agendamentoId: row.agendamento_id,
    pacoteId: row.pacote_id,
    descricao: row.descricao,
  };
}

export type ListLancamentosFilter = {
  periodoInicio?: string; // filtra por vencimento >=
  periodoFim?: string; // filtra por vencimento <=
  status?: PaymentStatus;
  patientId?: string;
  categoria?: CategoriaLancamento;
  tipo?: TipoLancamento;
};

export async function listLancamentos(
  supabase: SupabaseClient,
  psicologoId: string,
  filter: ListLancamentosFilter = {}
): Promise<Lancamento[]> {
  let query = supabase
    .from("lancamentos_financeiros")
    .select(COLUMNS)
    .eq("psicologo_id", psicologoId);

  if (filter.periodoInicio) query = query.gte("vencimento", filter.periodoInicio);
  if (filter.periodoFim) query = query.lte("vencimento", filter.periodoFim);
  if (filter.status) query = query.eq("status_pagamento", filter.status);
  if (filter.patientId) query = query.eq("paciente_id", filter.patientId);
  if (filter.categoria) query = query.eq("categoria", filter.categoria);
  if (filter.tipo) query = query.eq("tipo", filter.tipo);

  const { data, error } = await query.order("vencimento", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as LancamentoRow[]).map(rowToLancamento);
}

export async function listLancamentosByPatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .select(COLUMNS)
    .eq("paciente_id", patientId)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as LancamentoRow[]).map(rowToLancamento);
}

export type NewLancamentoInput = {
  tipo: TipoLancamento;
  patientId: string | null;
  patientName: string | null;
  valor: number;
  status: PaymentStatus;
  categoria: CategoriaLancamento;
  data: string;
  vencimento: string;
  formaPagamento: FormaPagamento | null;
  agendamentoId: string | null;
  pacoteId: string | null;
  descricao: string;
};

export async function createLancamento(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NewLancamentoInput
): Promise<Lancamento> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .insert({
      psicologo_id: psicologoId,
      tipo: input.tipo,
      paciente_id: input.tipo === "despesa" ? null : input.patientId,
      paciente_nome: input.tipo === "despesa" ? null : input.patientName,
      valor: input.valor,
      status_pagamento: input.status,
      categoria: input.categoria,
      data: input.data,
      vencimento: input.vencimento,
      pago_em: input.status === "pago" ? input.data : null,
      forma_pagamento: input.formaPagamento,
      agendamento_id: input.agendamentoId,
      pacote_id: input.pacoteId,
      descricao: input.descricao || null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToLancamento(data as LancamentoRow);
}

export async function updateLancamentoStatus(
  supabase: SupabaseClient,
  id: string,
  status: PaymentStatus,
  pagoEm?: string
): Promise<void> {
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({
      status_pagamento: status,
      pago_em: status === "pago" ? pagoEm ?? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLancamento(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// "Existe lançamento pra essa consulta?" — usado pelo atalho da Agenda
// (marcar realizada) pra não oferecer "lançar cobrança" duas vezes.
export async function lancamentoExistePorAgendamento(
  supabase: SupabaseClient,
  agendamentoId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .select("id")
    .eq("agendamento_id", agendamentoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
