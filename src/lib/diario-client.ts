import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type Visibilidade = "privada" | "compartilhada";

export type EntradaDiario = {
  id: string;
  conteudo: string;
  visibilidade: Visibilidade;
  createdAt: string;
};

type DiarioRow = {
  id: string;
  conteudo: string;
  visibilidade: Visibilidade;
  created_at: string;
};

const COLUNAS = "id, conteudo, visibilidade, created_at";

function rowToEntrada(row: DiarioRow): EntradaDiario {
  return {
    id: row.id,
    conteudo: row.conteudo,
    visibilidade: row.visibilidade,
    createdAt: row.created_at,
  };
}

/**
 * Usada pelos dois lados. Para o paciente devolve tudo (privadas e
 * compartilhadas); para o psicólogo, a RLS já filtra —
 * psicologo_le_diario_compartilhado exige visibilidade='compartilhada', então
 * entrada privada não sai do banco nem se alguém alterar esta query.
 */
export async function listDiario(
  supabase: SupabaseClient,
  clienteId: string
): Promise<EntradaDiario[]> {
  const { data, error } = await supabase
    .from("diario_paciente")
    .select(COLUNAS)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DiarioRow[]).map(rowToEntrada);
}

export async function criarEntradaDiario(
  supabase: SupabaseClient,
  clienteId: string,
  conteudo: string,
  visibilidade: Visibilidade
): Promise<EntradaDiario> {
  const { data, error } = await supabase
    .from("diario_paciente")
    .insert({ cliente_id: clienteId, conteudo, visibilidade })
    .select(COLUNAS)
    .single();
  if (error) throw new Error(error.message);
  return rowToEntrada(data as DiarioRow);
}

export async function alterarVisibilidade(
  supabase: SupabaseClient,
  entradaId: string,
  visibilidade: Visibilidade
): Promise<void> {
  const { data, error } = await supabase
    .from("diario_paciente")
    .update({ visibilidade })
    .eq("id", entradaId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A mudança de quem pode ver a entrada");
}

export async function apagarEntradaDiario(
  supabase: SupabaseClient,
  entradaId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("diario_paciente")
    .delete()
    .eq("id", entradaId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A entrada do diário");
}
