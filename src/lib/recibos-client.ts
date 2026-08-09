import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recibo } from "@/lib/dashboard-data";

type ReciboRow = {
  id: string;
  paciente_id: string;
  psicologo_id: string;
  numero: number;
  competencia_inicio: string;
  competencia_fim: string;
  valor_total: number;
  quantidade_sessoes: number;
  pagador_nome: string;
  pagador_cpf: string;
  emitido_em: string;
};

const COLUMNS =
  "id, paciente_id, psicologo_id, numero, competencia_inicio, competencia_fim, valor_total, quantidade_sessoes, pagador_nome, pagador_cpf, emitido_em";

function rowToRecibo(row: ReciboRow): Recibo {
  return {
    id: row.id,
    patientId: row.paciente_id,
    psicologoId: row.psicologo_id,
    numero: row.numero,
    competenciaInicio: row.competencia_inicio,
    competenciaFim: row.competencia_fim,
    valorTotal: row.valor_total,
    quantidadeSessoes: row.quantidade_sessoes,
    pagadorNome: row.pagador_nome,
    pagadorCpf: row.pagador_cpf,
    emitidoEm: row.emitido_em,
  };
}

export async function listRecibos(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<Recibo[]> {
  const { data, error } = await supabase
    .from("recibos")
    .select(COLUMNS)
    .eq("psicologo_id", psicologoId)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ReciboRow[]).map(rowToRecibo);
}

// Portal do paciente: sem filtro por psicologo_id (o paciente não tem essa
// info à mão) — a RLS (cliente_ve_proprios_recibos, via eh_meu_paciente())
// já restringe ao próprio.
export async function listMeusRecibos(supabase: SupabaseClient): Promise<Recibo[]> {
  const { data, error } = await supabase
    .from("recibos")
    .select(COLUMNS)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ReciboRow[]).map(rowToRecibo);
}

export async function getRecibo(
  supabase: SupabaseClient,
  id: string
): Promise<Recibo | null> {
  const { data, error } = await supabase
    .from("recibos")
    .select(COLUMNS)
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return rowToRecibo(data as ReciboRow);
}

export type NovoReciboInput = {
  patientId: string;
  competenciaInicio: string;
  competenciaFim: string;
  valorTotal: number;
  quantidadeSessoes: number;
  pagadorNome: string;
  pagadorCpf: string;
};

export async function emitirRecibo(
  supabase: SupabaseClient,
  input: NovoReciboInput
): Promise<Recibo> {
  const { data, error } = await supabase.rpc("emitir_recibo", {
    p_paciente_id: input.patientId,
    p_competencia_inicio: input.competenciaInicio,
    p_competencia_fim: input.competenciaFim,
    p_valor_total: input.valorTotal,
    p_quantidade_sessoes: input.quantidadeSessoes,
    p_pagador_nome: input.pagadorNome,
    p_pagador_cpf: input.pagadorCpf,
  });
  if (error) throw new Error(error.message);
  return rowToRecibo(data as ReciboRow);
}
