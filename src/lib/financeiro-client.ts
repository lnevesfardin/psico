import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus } from "@/lib/dashboard-data";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type TipoLancamento = "receita" | "despesa";

export type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  // Nulo em despesa (aluguel, material...) — não tem paciente associado.
  // Receita sempre traz os dois preenchidos (garantido pela constraint do
  // banco, não só pelo tipo do TypeScript).
  patientId: string | null;
  patientName: string | null;
  valor: number;
  status: PaymentStatus;
  data: string; // yyyy-mm-dd
  descricao: string | null;
};

export type LancamentoRow = {
  id: string;
  tipo: TipoLancamento;
  paciente_id: string | null;
  paciente_nome: string | null;
  valor: number;
  status_pagamento: PaymentStatus;
  data: string;
  descricao: string | null;
};

const COLUMNS =
  "id, tipo, paciente_id, paciente_nome, valor, status_pagamento, data, descricao";

export function rowToLancamento(row: LancamentoRow): Lancamento {
  return {
    id: row.id,
    tipo: row.tipo,
    patientId: row.paciente_id,
    patientName: row.paciente_nome,
    valor: row.valor,
    status: row.status_pagamento,
    data: row.data,
    descricao: row.descricao,
  };
}

/** Usado só pra pré-preencher o recibo a partir de um lançamento (ver Financeiro). */
export async function getLancamento(
  supabase: SupabaseClient,
  id: string
): Promise<Lancamento | null> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToLancamento(data as LancamentoRow) : null;
}

export async function listLancamentos(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .select(COLUMNS)
    .eq("psicologo_id", psicologoId)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as LancamentoRow[]).map(rowToLancamento);
}

export type NewLancamentoInput = {
  tipo: TipoLancamento;
  // Obrigatório pro form garantir em receita; opcional em despesa.
  patientId: string | null;
  patientName: string | null;
  valor: number;
  status: PaymentStatus;
  data: string;
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
      paciente_id: input.patientId,
      paciente_nome: input.patientName,
      valor: input.valor,
      status_pagamento: input.status,
      data: input.data,
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
  status: PaymentStatus
): Promise<void> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status_pagamento: status })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A baixa do lançamento");
}

export async function deleteLancamento(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "O lançamento");
}
