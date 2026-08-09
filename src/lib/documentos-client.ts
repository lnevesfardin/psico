import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateShort } from "@/lib/format";

export type TipoDocumento = "declaracao" | "atestado";

export type Documento = {
  id: string;
  patientId: string;
  numero: number;
  tipo: TipoDocumento;
  finalidade: string;
  conteudo: string;
  diasAfastamento: number | null;
  dataInicioAfastamento: string | null;
  emitidoEm: string;
};

type DocumentoRow = {
  id: string;
  paciente_id: string;
  numero: number;
  tipo: TipoDocumento;
  finalidade: string;
  conteudo: string;
  dias_afastamento: number | null;
  data_inicio_afastamento: string | null;
  emitido_em: string;
};

const COLUMNS =
  "id, paciente_id, numero, tipo, finalidade, conteudo, dias_afastamento, data_inicio_afastamento, emitido_em";

function rowToDocumento(row: DocumentoRow): Documento {
  return {
    id: row.id,
    patientId: row.paciente_id,
    numero: row.numero,
    tipo: row.tipo,
    finalidade: row.finalidade,
    conteudo: row.conteudo,
    diasAfastamento: row.dias_afastamento,
    dataInicioAfastamento: row.data_inicio_afastamento,
    emitidoEm: row.emitido_em,
  };
}

export async function listDocumentosByPatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<Documento[]> {
  const { data, error } = await supabase
    .from("documentos_psicologicos")
    .select(COLUMNS)
    .eq("paciente_id", patientId)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DocumentoRow[]).map(rowToDocumento);
}

export async function getDocumento(supabase: SupabaseClient, id: string): Promise<Documento | null> {
  const { data, error } = await supabase.from("documentos_psicologicos").select(COLUMNS).eq("id", id).single();
  if (error || !data) return null;
  return rowToDocumento(data as DocumentoRow);
}

// Texto fixo, montado em código (não por IA — documento formal com valor
// legal segue estrutura da Res. CFP 06/2019, sem espaço para geração
// probabilística). Nunca menciona diagnóstico/CID: "finalidade" é a única
// parte livre, preenchida pelo psicólogo, e mesmo assim o texto ao redor
// deixa claro que o conteúdo clínico não é exposto.
export function composeDeclaracao(input: {
  pacienteNome: string;
  pacienteCpf: string;
  finalidade: string;
}): string {
  return `Declaro, para os devidos fins${input.finalidade ? ` de ${input.finalidade}` : ""}, que ${input.pacienteNome}${input.pacienteCpf ? `, portador(a) do CPF ${input.pacienteCpf},` : ""} está em acompanhamento psicológico sob minha responsabilidade profissional.

Por ser expressão da verdade, firmo a presente declaração, em conformidade com a Resolução CFP nº 06/2019.`;
}

export function composeAtestado(input: {
  pacienteNome: string;
  pacienteCpf: string;
  finalidade: string;
  diasAfastamento: number | null;
  dataInicioAfastamento: string | null;
}): string {
  const periodo =
    input.diasAfastamento && input.dataInicioAfastamento
      ? ` pelo período de ${input.diasAfastamento} dia(s), a partir de ${formatDateShort(input.dataInicioAfastamento)},`
      : input.diasAfastamento
        ? ` pelo período de ${input.diasAfastamento} dia(s),`
        : "";

  return `Atesto, para os devidos fins${input.finalidade ? ` de ${input.finalidade}` : ""}, que ${input.pacienteNome}${input.pacienteCpf ? `, portador(a) do CPF ${input.pacienteCpf},` : ""} necessita de afastamento de suas atividades por motivo de saúde psicológica${periodo}.

Este atestado não expõe diagnóstico ou detalhe clínico, em respeito ao sigilo profissional.

Por ser expressão da verdade, firmo o presente atestado, em conformidade com a Resolução CFP nº 06/2019.`;
}

export type NovoDocumentoInput = {
  patientId: string;
  tipo: TipoDocumento;
  finalidade: string;
  conteudo: string;
  diasAfastamento: number | null;
  dataInicioAfastamento: string | null;
};

export async function emitirDocumento(
  supabase: SupabaseClient,
  input: NovoDocumentoInput
): Promise<Documento> {
  const { data, error } = await supabase.rpc("emitir_documento", {
    p_paciente_id: input.patientId,
    p_tipo: input.tipo,
    p_finalidade: input.finalidade,
    p_conteudo: input.conteudo,
    p_dias_afastamento: input.diasAfastamento,
    p_data_inicio_afastamento: input.dataInicioAfastamento,
  });
  if (error) throw new Error(error.message);
  return rowToDocumento(data as DocumentoRow);
}
