import type { SupabaseClient } from "@supabase/supabase-js";

export const MATERIAIS_BUCKET = "materiais-paciente";
/** Teto por arquivo. Áudio de meditação guiada cabe folgado em 25 MB. */
export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;

export type Material = {
  id: string;
  titulo: string;
  descricao: string;
  storagePath: string;
  nomeArquivo: string;
  tipoMime: string;
  tamanhoBytes: number;
  createdAt: string;
};

type MaterialRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  storage_path: string;
  nome_arquivo: string;
  tipo_mime: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};

const COLUNAS =
  "id, titulo, descricao, storage_path, nome_arquivo, tipo_mime, tamanho_bytes, created_at";

function rowToMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao ?? "",
    storagePath: row.storage_path,
    nomeArquivo: row.nome_arquivo,
    tipoMime: row.tipo_mime ?? "",
    tamanhoBytes: row.tamanho_bytes ?? 0,
    createdAt: row.created_at,
  };
}

/**
 * Deixa na chave do objeto só o que o Storage do Supabase aceita sem
 * reclamar (acento, espaço e símbolo caem fora). O nome original continua
 * salvo em nome_arquivo — é ele que a pessoa vê e baixa, então perder a
 * grafia bonita aqui não custa nada.
 */
function slugificarArquivo(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function listMateriais(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materiais_paciente")
    .select(COLUNAS)
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as MaterialRow[]).map(rowToMaterial);
}

/**
 * Materiais do paciente logado. Sem filtro por paciente_id de propósito: o
 * cliente não conhece o próprio id na tabela "pacientes" (é um cadastro do
 * psicólogo), e a policy cliente_le_proprios_materiais já limita o retorno
 * ao que foi enviado para a ficha dele.
 */
export async function listMeusMateriais(
  supabase: SupabaseClient
): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materiais_paciente")
    .select(COLUNAS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as MaterialRow[]).map(rowToMaterial);
}

export async function enviarMaterial(
  supabase: SupabaseClient,
  pacienteId: string,
  arquivo: File,
  titulo: string,
  descricao: string
): Promise<Material> {
  if (arquivo.size > MAX_MATERIAL_BYTES) {
    throw new Error("Arquivo muito grande. O limite é 25 MB.");
  }

  // Primeira pasta = paciente_id: é assim que as policies de storage.objects
  // decidem quem pode ler/gravar o arquivo (ver schema.sql). O prefixo
  // aleatório evita colisão quando o mesmo nome é enviado duas vezes.
  const path = `${pacienteId}/${crypto.randomUUID()}-${slugificarArquivo(arquivo.name)}`;

  const { error: upErro } = await supabase.storage
    .from(MATERIAIS_BUCKET)
    .upload(path, arquivo, { contentType: arquivo.type || undefined });
  if (upErro) throw new Error(upErro.message);

  const { data, error } = await supabase
    .from("materiais_paciente")
    .insert({
      paciente_id: pacienteId,
      titulo,
      descricao: descricao.trim() || null,
      storage_path: path,
      nome_arquivo: arquivo.name,
      tipo_mime: arquivo.type || null,
      tamanho_bytes: arquivo.size,
    })
    .select(COLUNAS)
    .single();

  if (error) {
    // Sem isso o arquivo ficaria órfão no bucket, invisível na interface e
    // ocupando espaço para sempre.
    await supabase.storage.from(MATERIAIS_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return rowToMaterial(data as MaterialRow);
}

export async function apagarMaterial(
  supabase: SupabaseClient,
  material: Material
): Promise<void> {
  const { error } = await supabase
    .from("materiais_paciente")
    .delete()
    .eq("id", material.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(MATERIAIS_BUCKET).remove([material.storagePath]);
}

/** URL temporária (1h) — o bucket é privado, não existe link permanente. */
export async function urlDoMaterial(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MATERIAIS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível abrir o arquivo.");
  }
  return data.signedUrl;
}

export function formatarTamanho(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
