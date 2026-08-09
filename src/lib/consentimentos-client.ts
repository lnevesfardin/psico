import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoConsentimento = "contrato_tdic" | "lgpd" | "gravacao_sessao" | "processamento_ia";

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
    versao: "1.1",
    titulo: "Termo de tratamento de dados pessoais (LGPD)",
    texto:
      "Seus dados pessoais e de saúde são tratados com a finalidade exclusiva de viabilizar o atendimento psicológico (agendamento, prontuário, cobrança e comunicação sobre a consulta), com base no consentimento do titular e na tutela da saúde, nos termos da Lei nº 13.709/2018 (LGPD). Os dados são retidos pelo prazo mínimo de 5 (cinco) anos a contar do último atendimento, podendo ser maior quando exigido pelas Resoluções CFP 01/2009 e 06/2019 ou por obrigação legal, e protegidos por controle de acesso restrito ao profissional responsável. Você pode solicitar informações sobre seus dados, portabilidade do prontuário ou esclarecimentos sobre o prazo de guarda a qualquer momento.",
  },
  gravacao_sessao: {
    versao: "1.0",
    titulo: "Termo de consentimento para gravação de sessão",
    texto:
      "Você concorda que a sessão de atendimento psicológico seja gravada em áudio, nos termos da Resolução CFP nº 13/2022, exclusivamente para apoiar o registro da evolução clínica pelo profissional responsável. O áudio é processado no momento da sessão para gerar a transcrição e não fica armazenado depois disso — só o texto revisado e salvo pelo profissional integra o prontuário. Você pode retirar este consentimento a qualquer momento, inclusive durante uma sessão futura, sem prejuízo ao atendimento.",
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

// Consentimentos "pendentes" = tipo obrigatório sem aceite ativo DA VERSÃO
// ATUAL (aceito=true, não revogado e versaoTexto igual à de
// TEXTOS_CONSENTIMENTO). Comparar a versão importa: se o texto de um termo
// muda (ex.: lgpd 1.0 -> 1.1, ver acima), quem só aceitou a versão antiga
// nunca leu o texto novo — sem essa checagem, o termo ficava marcado como
// "aceito" pra sempre, mesmo depois de o conteúdo mudar. gravacao_sessao
// fica fora desta lista de propósito — é pedido pontualmente na hora de
// gravar (ver session-transcription-modal.tsx), não uma vez só no portal.
const TIPOS_OBRIGATORIOS: TipoConsentimento[] = ["contrato_tdic", "lgpd", "processamento_ia"];

// Independe de TIPOS_OBRIGATORIOS — usada tanto pros 3 obrigatórios quanto
// pros opcionais (ex.: gravacao_sessao, que não é pendência de bloqueio mas
// ainda precisa mostrar "aceito" só quando realmente há um aceite ativo da
// versão atual, não por omissão de não estar na lista de obrigatórios).
export function consentimentoAtivo(aceitos: Consentimento[], tipo: TipoConsentimento): boolean {
  return aceitos.some(
    (c) => c.tipo === tipo && c.aceito && !c.revogadoEm && c.versaoTexto === TEXTOS_CONSENTIMENTO[tipo].versao
  );
}

export function consentimentosPendentes(aceitos: Consentimento[]): TipoConsentimento[] {
  return TIPOS_OBRIGATORIOS.filter((tipo) => !consentimentoAtivo(aceitos, tipo));
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

// Chamada pelo PSICÓLOGO (não pelo paciente) — ver comentário em
// registrar_consentimento_gravacao no schema.sql sobre por que esta é a
// única exceção ao padrão "o titular aceita pela própria conta".
export async function registrarConsentimentoGravacao(pacienteId: string): Promise<void> {
  const res = await fetch("/api/consentimentos/registrar-gravacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pacienteId }),
  });
  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    throw new Error(result?.error ?? "Não foi possível registrar o consentimento de gravação.");
  }
}
