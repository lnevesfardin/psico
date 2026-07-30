import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus } from "@/lib/dashboard-data";

export type Lancamento = {
  id: string;
  patientId: string;
  patientName: string;
  valor: number;
  status: PaymentStatus;
  data: string; // yyyy-mm-dd
  descricao: string | null;
};

export type LancamentoRow = {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  valor: number;
  status_pagamento: PaymentStatus;
  data: string;
  descricao: string | null;
};

const COLUMNS =
  "id, paciente_id, paciente_nome, valor, status_pagamento, data, descricao";

export function rowToLancamento(row: LancamentoRow): Lancamento {
  return {
    id: row.id,
    patientId: row.paciente_id,
    patientName: row.paciente_nome,
    valor: row.valor,
    status: row.status_pagamento,
    data: row.data,
    descricao: row.descricao,
  };
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
  patientId: string;
  patientName: string;
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
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status_pagamento: status })
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
