import type { SupabaseClient } from "@supabase/supabase-js";
import type { Instrumento, ResultadoSubescala } from "@/lib/instrumentos/scoring";

type InstrumentoRow = {
  id: string;
  sigla: string;
  nome: string;
  itens: Instrumento["itens"];
  faixas: Instrumento["faixas"];
  licenca: Instrumento["licenca"];
  fonte: string;
};

function rowToInstrumento(row: InstrumentoRow): Instrumento {
  return {
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    itens: row.itens,
    faixas: row.faixas,
    licenca: row.licenca,
    fonte: row.fonte,
  };
}

// Catálogo inteiro (só os "livre" vêm com itens preenchidos — instrumentos
// "restrito_manual" existiriam com itens vazio, o app nunca reproduz o
// conteúdo deles; ver seed em schema.sql).
export async function listInstrumentos(supabase: SupabaseClient): Promise<Instrumento[]> {
  const { data, error } = await supabase
    .from("instrumentos")
    .select("id, sigla, nome, itens, faixas, licenca, fonte")
    .order("sigla", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as InstrumentoRow[]).map(rowToInstrumento);
}

export type AplicacaoInstrumento = {
  id: string;
  patientId: string;
  instrumentoId: string;
  instrumentoSigla: string;
  instrumentoNome: string;
  tokenPublico: string | null;
  expiraEm: string | null;
  respostas: Record<number, number> | null;
  escore: number | null;
  faixa: string | null;
  resultadoDetalhado: Record<string, ResultadoSubescala> | null;
  origem: "formulario" | "manual";
  enviadoEm: string;
  respondidoEm: string | null;
};

type AplicacaoRow = {
  id: string;
  paciente_id: string;
  instrumento_id: string;
  token_publico: string | null;
  expira_em: string | null;
  respostas: Record<number, number> | null;
  escore: number | null;
  faixa: string | null;
  resultado_detalhado: Record<string, ResultadoSubescala> | null;
  origem: "formulario" | "manual";
  enviado_em: string;
  respondido_em: string | null;
  instrumentos: { sigla: string; nome: string } | null;
};

const APLICACAO_COLUMNS =
  "id, paciente_id, instrumento_id, token_publico, expira_em, respostas, escore, faixa, resultado_detalhado, origem, enviado_em, respondido_em, instrumentos(sigla, nome)";

function rowToAplicacao(row: AplicacaoRow): AplicacaoInstrumento {
  return {
    id: row.id,
    patientId: row.paciente_id,
    instrumentoId: row.instrumento_id,
    instrumentoSigla: row.instrumentos?.sigla ?? "",
    instrumentoNome: row.instrumentos?.nome ?? "",
    tokenPublico: row.token_publico,
    expiraEm: row.expira_em,
    respostas: row.respostas,
    escore: row.escore,
    faixa: row.faixa,
    resultadoDetalhado: row.resultado_detalhado,
    origem: row.origem,
    enviadoEm: row.enviado_em,
    respondidoEm: row.respondido_em,
  };
}

export async function listAplicacoesByPatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<AplicacaoInstrumento[]> {
  const { data, error } = await supabase
    .from("aplicacoes_instrumento")
    .select(APLICACAO_COLUMNS)
    .eq("paciente_id", patientId)
    .order("enviado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as AplicacaoRow[]).map(rowToAplicacao);
}

// Envio de escala de uso livre: gera o token público (crypto.randomUUID() —
// 122 bits de entropia, mesmo padrão de segurança do hex de 24 bytes usado
// em convites_paciente) e deixa a linha "aberta" pro paciente responder pelo
// link. Diferente de convite, aqui repetir o envio ao longo do tratamento é
// o uso normal (é o que alimenta o gráfico de evolução), então não reaproveita
// token pendente.
export async function enviarInstrumento(
  supabase: SupabaseClient,
  psicologoId: string,
  input: { patientId: string; instrumentoId: string; expiraEmDias: number | null }
): Promise<AplicacaoInstrumento> {
  const expiraEm = input.expiraEmDias
    ? new Date(Date.now() + input.expiraEmDias * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data, error } = await supabase
    .from("aplicacoes_instrumento")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      instrumento_id: input.instrumentoId,
      token_publico: crypto.randomUUID(),
      expira_em: expiraEm,
      origem: "formulario",
    })
    .select(APLICACAO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToAplicacao(data as unknown as AplicacaoRow);
}

// Registro manual: pra instrumentos "restrito_manual" (proprietários), o
// psicólogo aplica a escala fora do app (papel, plataforma licenciada) e só
// digita o resultado aqui — nunca reproduzimos os itens desses instrumentos.
export async function registrarEscoreManual(
  supabase: SupabaseClient,
  psicologoId: string,
  input: { patientId: string; instrumentoId: string; escore: number; faixa: string }
): Promise<AplicacaoInstrumento> {
  const { data, error } = await supabase
    .from("aplicacoes_instrumento")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      instrumento_id: input.instrumentoId,
      escore: input.escore,
      faixa: input.faixa,
      origem: "manual",
      respondido_em: new Date().toISOString(),
    })
    .select(APLICACAO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToAplicacao(data as unknown as AplicacaoRow);
}

export async function deleteAplicacao(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("aplicacoes_instrumento").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Acesso público (token), pra /escala/[token] — sem sessão, mesmo padrão de
// convite_info/aceitar_convite_paciente: RPC security definer que devolve só
// o mínimo necessário, nunca uma policy de select direta na tabela.
// ---------------------------------------------------------------------------

export type EscalaInfo = {
  instrumentoSigla: string;
  instrumentoNome: string;
  instrumentoItens: Instrumento["itens"];
  instrumentoFaixas: Instrumento["faixas"];
  instrumentoLicenca: Instrumento["licenca"];
  expirado: boolean;
  jaRespondido: boolean;
};

type EscalaInfoRow = {
  instrumento_sigla: string;
  instrumento_nome: string;
  instrumento_itens: Instrumento["itens"];
  instrumento_faixas: Instrumento["faixas"];
  instrumento_licenca: Instrumento["licenca"];
  expirado: boolean;
  ja_respondido: boolean;
};

export async function fetchEscalaInfo(
  supabase: SupabaseClient,
  token: string
): Promise<EscalaInfo | null> {
  const { data, error } = await supabase
    .rpc("escala_info", { p_token: token })
    .maybeSingle<EscalaInfoRow>();
  if (error || !data) return null;
  return {
    instrumentoSigla: data.instrumento_sigla,
    instrumentoNome: data.instrumento_nome,
    instrumentoItens: data.instrumento_itens,
    instrumentoFaixas: data.instrumento_faixas,
    instrumentoLicenca: data.instrumento_licenca,
    expirado: data.expirado,
    jaRespondido: data.ja_respondido,
  };
}

export async function responderEscala(
  supabase: SupabaseClient,
  token: string,
  input: {
    respostas: Record<number, number>;
    escore: number;
    faixa: string;
    resultadoDetalhado: Record<string, ResultadoSubescala> | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("responder_escala", {
    p_token: token,
    p_respostas: input.respostas,
    p_escore: input.escore,
    p_faixa: input.faixa,
    p_resultado_detalhado: input.resultadoDetalhado,
  });
  if (error) throw new Error(error.message);
}
