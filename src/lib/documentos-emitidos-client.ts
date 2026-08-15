import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type DocumentoEmitido = {
  id: string;
  tipo: string;
  modeloNome: string;
  conteudo: string;
  createdAt: string;
};

type DocumentoRow = {
  id: string;
  tipo: string;
  modelo_nome: string;
  conteudo: string;
  created_at: string;
};

const DOCUMENTO_COLUMNS = "id, tipo, modelo_nome, conteudo, created_at";

function rowToDocumento(row: DocumentoRow): DocumentoEmitido {
  return {
    id: row.id,
    tipo: row.tipo,
    modeloNome: row.modelo_nome,
    conteudo: row.conteudo,
    createdAt: row.created_at,
  };
}

export async function listDocumentosEmitidos(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<DocumentoEmitido[]> {
  const { data, error } = await supabase
    .from("documentos_emitidos")
    .select(DOCUMENTO_COLUMNS)
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DocumentoRow[]).map(rowToDocumento);
}

export async function criarDocumentoEmitido(
  supabase: SupabaseClient,
  pacienteId: string,
  input: { tipo: string; modeloNome: string; conteudo: string }
): Promise<DocumentoEmitido> {
  const { data, error } = await supabase
    .from("documentos_emitidos")
    .insert({
      paciente_id: pacienteId,
      tipo: input.tipo,
      modelo_nome: input.modeloNome,
      conteudo: input.conteudo,
    })
    .select(DOCUMENTO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToDocumento(data as DocumentoRow);
}

export async function apagarDocumentoEmitido(
  supabase: SupabaseClient,
  documentoId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("documentos_emitidos")
    .delete()
    .eq("id", documentoId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "O documento");
}
