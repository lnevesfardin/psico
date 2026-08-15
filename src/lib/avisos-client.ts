import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type Aviso = {
  id: string;
  mensagem: string;
  lido: boolean;
  createdAt: string;
};

type AvisoRow = {
  id: string;
  mensagem: string;
  lido: boolean;
  created_at: string;
};

function rowToAviso(row: AvisoRow): Aviso {
  return { id: row.id, mensagem: row.mensagem, lido: row.lido, createdAt: row.created_at };
}

export async function listAvisos(supabase: SupabaseClient): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from("avisos_psicologo")
    .select("id, mensagem, lido, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data as AvisoRow[]).map(rowToAviso);
}

export async function marcarAvisoLido(
  supabase: SupabaseClient,
  avisoId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("avisos_psicologo")
    .update({ lido: true })
    .eq("id", avisoId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A baixa do aviso");
}

export async function marcarTodosAvisosLidos(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("avisos_psicologo")
    .update({ lido: true })
    .eq("lido", false);
  if (error) throw new Error(error.message);
}
