import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoConsentimento = "contrato_tdic" | "lgpd" | "processamento_ia";

export type Consentimento = {
  id: string;
  tipo: TipoConsentimento;
  versaoTexto: string;
  aceito: boolean;
  aceitoEm: string;
  revogadoEm: string | null;
};

type ConsentimentoRow = {
  id: string;
  tipo: TipoConsentimento;
  versao_texto: string;
  aceito: boolean;
  aceito_em: string;
  revogado_em: string | null;
};

function rowToConsentimento(row: ConsentimentoRow): Consentimento {
  return {
    id: row.id,
    tipo: row.tipo,
    versaoTexto: row.versao_texto,
    aceito: row.aceito,
    aceitoEm: row.aceito_em,
    revogadoEm: row.revogado_em,
  };
}

// Textos padrão — versão simples, fixa. Trocar o TEXTO abaixo exige
// incrementar a VERSAO correspondente (é isso que o paciente assina de
// verdade: o texto + a versão, guardados por completo em cada aceite).
export const TEXTOS_CONSENTIMENTO: Record<TipoConsentimento, { versao: string; titulo: string; texto: string }> = {
  contrato_tdic: {
    versao: "1.0",
    titulo: "Contrato de prestação de serviço por meio digital",
    texto:
      "Este atendimento psicológico é prestado por meio de tecnologia digital de informação e comunicação (TDIC), nos termos da Resolução CFP nº 09/2024. O paciente declara estar ciente de que a consulta pode ocorrer de forma remota, dos recursos tecnológicos utilizados pela plataforma (agendamento online, videochamada, prontuário eletrônico) e concorda com os termos de uso do serviço. Fica eleito o foro do domicílio do paciente para dirimir eventuais controvérsias.",
  },
  lgpd: {
    versao: "1.0",
    titulo: "Termo de tratamento de dados pessoais (LGPD)",
    texto:
      "Seus dados pessoais e de saúde são tratados com a finalidade exclusiva de viabilizar o atendimento psicológico (agendamento, prontuário, cobrança e comunicação sobre a consulta), com base no consentimento do titular e na tutela da saúde, nos termos da Lei nº 13.709/2018 (LGPD). Os dados são retidos pelo prazo mínimo exigido pelas Resoluções CFP 01/2009 e 06/2019 e protegidos por controle de acesso restrito ao profissional responsável. Você pode solicitar informações sobre seus dados a qualquer momento.",
  },
  processamento_ia: {
    versao: "1.0",
    titulo: "Termo de processamento por inteligência artificial",
    texto:
      "Esta plataforma pode utilizar inteligência artificial como apoio administrativo ao profissional (ex.: rascunho de anotações a partir de transcrição de áudio, organização de lançamentos financeiros). Nenhuma decisão clínica é tomada por IA, e todo conteúdo gerado é revisado e assinado pelo profissional antes de ter qualquer efeito. Você pode retirar este consentimento a qualquer momento, o que desativa o uso de IA nos seus dados.",
  },
};

export async function listMeusConsentimentos(
  supabase: SupabaseClient
): Promise<Consentimento[]> {
  const { data, error } = await supabase
    .from("consentimentos")
    .select("id, tipo, versao_texto, aceito, aceito_em, revogado_em")
    .order("aceito_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ConsentimentoRow[]).map(rowToConsentimento);
}

// Consentimentos "pendentes" = tipo obrigatório sem aceite ativo
// (aceito=true e não revogado) ainda. gravacao_sessao fica fora desta
// lista de propósito — é pedido pontualmente na hora de gravar (ver
// session-transcription-modal.tsx), não uma vez só no portal.
const TIPOS_OBRIGATORIOS: TipoConsentimento[] = ["contrato_tdic", "lgpd", "processamento_ia"];

export function consentimentosPendentes(aceitos: Consentimento[]): TipoConsentimento[] {
  const ativos = new Set(
    aceitos.filter((c) => c.aceito && !c.revogadoEm).map((c) => c.tipo)
  );
  return TIPOS_OBRIGATORIOS.filter((tipo) => !ativos.has(tipo));
}

// Passa pela rota (não chama a RPC direto do client) porque precisa do IP
// do visitante, que só está disponível no cabeçalho da requisição de um
// route handler — ver src/app/api/consentimentos/aceitar/route.ts.
export async function aceitarConsentimento(tipo: TipoConsentimento): Promise<void> {
  const res = await fetch("/api/consentimentos/aceitar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo }),
  });
  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    throw new Error(result?.error ?? "Não foi possível registrar o aceite.");
  }
}
