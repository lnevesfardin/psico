import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type StatusListaEspera = "aguardando" | "atendido";

export type EntradaListaEspera = {
  id: string;
  patientId: string | null;
  nome: string;
  telefone: string;
  observacao: string;
  status: StatusListaEspera;
  createdAt: string;
};

type ListaEsperaRow = {
  id: string;
  paciente_id: string | null;
  nome: string;
  telefone: string | null;
  observacao: string | null;
  status: StatusListaEspera;
  created_at: string;
};

const COLUMNS =
  "id, paciente_id, nome, telefone, observacao, status, created_at";

function rowToEntrada(row: ListaEsperaRow): EntradaListaEspera {
  return {
    id: row.id,
    patientId: row.paciente_id,
    nome: row.nome,
    telefone: row.telefone ?? "",
    observacao: row.observacao ?? "",
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Mais antigo primeiro (FIFO) — a UI separa "aguardando" de "atendido". */
export async function listListaEspera(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<EntradaListaEspera[]> {
  const { data, error } = await supabase
    .from("lista_espera")
    .select(COLUMNS)
    .eq("psicologo_id", psicologoId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ListaEsperaRow[]).map(rowToEntrada);
}

export type NovaEntradaListaEspera = {
  patientId: string | null;
  nome: string;
  telefone: string;
  observacao: string;
};

export async function addListaEspera(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NovaEntradaListaEspera
): Promise<EntradaListaEspera> {
  const { data, error } = await supabase
    .from("lista_espera")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      nome: input.nome,
      telefone: input.telefone || null,
      observacao: input.observacao || null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToEntrada(data as ListaEsperaRow);
}

export async function updateStatusListaEspera(
  supabase: SupabaseClient,
  id: string,
  status: StatusListaEspera
): Promise<void> {
  const { data, error } = await supabase
    .from("lista_espera")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A atualização da lista de espera");
}

export async function removeListaEspera(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { data, error } = await supabase
    .from("lista_espera")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A remoção da lista de espera");
}
