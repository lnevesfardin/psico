import type { SupabaseClient } from "@supabase/supabase-js";
import type { EscalaSlug } from "@/lib/escalas";
import { getJogo } from "@/lib/jogos";

/**
 * Espaço Interativo do paciente: as atividades que o psicólogo dele enviou.
 *
 * São dois tipos, das duas tabelas de convite (ver minhas_atividades no
 * schema.sql): "escala" (instrumento de rastreio, que pontua) e "jogo"
 * (exercício de reflexão e regulação, que não pontua). O paciente vê os dois
 * lado a lado, mas o cartão de cada um é montado por caminhos diferentes.
 */

export type TipoAtividade = "escala" | "jogo";

export type AtividadePaciente = {
  tipo: TipoAtividade;
  token: string;
  /** Slug da escala ou do jogo, conforme o tipo. */
  escala: string;
  psicologoId: string;
  psicologoNome: string;
  criadoEm: string;
  respondidoEm: string | null;
};

type AtividadeRow = {
  tipo: string | null;
  token: string;
  escala: string;
  psicologo_id: string;
  psicologo_nome: string | null;
  criado_em: string;
  respondido_em: string | null;
};

export async function listMinhasAtividades(
  supabase: SupabaseClient
): Promise<AtividadePaciente[]> {
  const { data, error } = await supabase.rpc("minhas_atividades");

  // O schema deste projeto é aplicado à mão, então o deploy pode chegar antes
  // da função existir. Nesse caso a tela mostra "nenhuma atividade ainda", que
  // é a verdade para o paciente — melhor do que um erro vermelho que ele não
  // tem como resolver. Qualquer outra falha continua subindo.
  if (error) {
    if (/minhas_atividades/i.test(error.message)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as AtividadeRow[]).map((row) => ({
    // Banco anterior aos jogos não devolvia "tipo" — tudo que vinha era escala.
    tipo: row.tipo === "jogo" ? "jogo" : "escala",
    token: row.token,
    escala: row.escala,
    psicologoId: row.psicologo_id,
    psicologoNome: row.psicologo_nome ?? "seu psicólogo",
    criadoEm: row.criado_em,
    respondidoEm: row.respondido_em,
  }));
}

/**
 * Cor do banner como chave, e não classe montada em tempo de execução: o
 * Tailwind gera CSS lendo o código-fonte, então `bg-${cor}-500` sairia sem
 * estilo. As classes completas ficam em patient-activity-card.tsx.
 */
export type ActivityThemeColor =
  | "roxo"
  | "azul"
  | "verde"
  | "laranja"
  | "rosa"
  | "sobrio";

export type ActivityIconType =
  | "heart"
  | "brain"
  | "smile"
  | "shield"
  | "star"
  | "wind"
  | "users";

export type ActivityPresentation = {
  /** Título em linguagem comum — o nome técnico fica em "instrumento". */
  title: string;
  description: string;
  /** Nome oficial do instrumento: o paciente tem direito de saber o que responde. */
  instrumento: string;
  estimatedTime: string;
  tags: string[];
  themeColor: ActivityThemeColor;
  iconType: ActivityIconType;
  /**
   * Escala de risco não recebe tratamento lúdico. Cartão sóbrio, sem cor
   * vibrante, e com o contato do CVV à vista — gamificar rastreio de ideação
   * suicida seria leviano com quem está justamente mal.
   */
  sensivel?: boolean;
};

export const APRESENTACAO: Record<EscalaSlug, ActivityPresentation> = {
  phq9: {
    title: "Como têm sido suas últimas semanas",
    description:
      "Nove perguntas sobre sono, ânimo, apetite e concentração nos últimos 15 dias. Responda pensando no que foi mais frequente, sem se cobrar exatidão.",
    instrumento: "PHQ-9",
    estimatedTime: "3-5 min",
    tags: ["Bem-estar", "Humor"],
    themeColor: "azul",
    iconType: "smile",
  },
  phq2: {
    title: "Como você tem se sentido",
    description:
      "Duas perguntas rápidas sobre ânimo e interesse nas últimas semanas — uma triagem curta antes de perguntas mais completas, se fizer sentido.",
    instrumento: "PHQ-2",
    estimatedTime: "1 min",
    tags: ["Bem-estar", "Humor"],
    themeColor: "azul",
    iconType: "smile",
  },
  gad7: {
    title: "Preocupação e ansiedade no seu dia",
    description:
      "Sete perguntas sobre nervosismo, preocupação e irritação nas últimas duas semanas. Ajuda seu psicólogo a entender o tamanho disso no seu cotidiano.",
    instrumento: "GAD-7",
    estimatedTime: "3 min",
    tags: ["Ansiedade", "Bem-estar"],
    themeColor: "verde",
    iconType: "brain",
  },
  "snap-iv": {
    title: "Atenção, agitação e rotina",
    description:
      "Perguntas sobre concentração, organização e inquietação no dia a dia. Costuma ser respondida por quem acompanha de perto a rotina da criança ou do adolescente.",
    instrumento: "SNAP-IV",
    estimatedTime: "5-8 min",
    tags: ["Atenção", "Rotina"],
    themeColor: "laranja",
    iconType: "brain",
  },
  cssrs: {
    title: "Perguntas sobre pensamentos difíceis",
    description:
      "Seu psicólogo pediu estas perguntas para entender como você tem passado em momentos ruins. São diretas e podem ser duras de ler — responda com calma, no seu tempo.",
    instrumento: "C-SSRS",
    estimatedTime: "3 min",
    tags: ["Acompanhamento"],
    themeColor: "sobrio",
    iconType: "shield",
    sensivel: true,
  },
  srq20: {
    title: "Como sua saúde tem andado",
    description:
      "Vinte perguntas de sim ou não sobre sono, ânimo e sintomas físicos comuns quando estamos sobrecarregados. Responda pensando nas últimas semanas.",
    instrumento: "SRQ-20",
    estimatedTime: "3-5 min",
    tags: ["Bem-estar"],
    themeColor: "azul",
    iconType: "smile",
  },
  gds15: {
    title: "Como você tem se sentido ultimamente",
    description:
      "Quinze perguntas de sim ou não sobre ânimo, interesse e satisfação com a vida na última semana.",
    instrumento: "GDS-15",
    estimatedTime: "3-5 min",
    tags: ["Bem-estar", "Humor"],
    themeColor: "verde",
    iconType: "smile",
  },
  dass21: {
    title: "Depressão, ansiedade e estresse",
    description:
      "Vinte e uma afirmações sobre como você tem se sentido na última semana. O resultado sai separado em três partes — não é um número só.",
    instrumento: "DASS-21",
    estimatedTime: "5-7 min",
    tags: ["Bem-estar", "Ansiedade", "Humor"],
    themeColor: "roxo",
    iconType: "brain",
  },
  epds: {
    title: "Como você tem se sentido nos últimos dias",
    description:
      "Dez perguntas sobre humor e ânimo na última semana, pensadas especialmente para esse momento pós-parto. Uma das perguntas é mais direta — responda com calma, no seu tempo.",
    instrumento: "EPDS",
    estimatedTime: "3-5 min",
    tags: ["Bem-estar", "Maternidade"],
    themeColor: "sobrio",
    iconType: "heart",
    sensivel: true,
  },
};

/**
 * Monta o cartão de qualquer atividade. Escala tem apresentação escrita à
 * mão (o nome técnico precisa de tradução cuidadosa para o paciente); jogo
 * já nasce com nome e descrição em linguagem comum, então vem direto do
 * catálogo em jogos.ts.
 */
export function apresentacaoDa(
  atividade: Pick<AtividadePaciente, "tipo" | "escala">
): ActivityPresentation | null {
  if (atividade.tipo === "escala") {
    return APRESENTACAO[atividade.escala as EscalaSlug] ?? null;
  }

  const jogo = getJogo(atividade.escala);
  if (!jogo) return null;

  return {
    title: jogo.nome,
    description: jogo.descricao,
    instrumento: "Atividade",
    estimatedTime: jogo.duracao,
    tags: jogo.temas,
    themeColor: jogo.cor,
    iconType: jogo.icone,
  };
}

/** Enviada nos últimos 14 dias e ainda sem resposta. */
export function ehNovidade(atividade: AtividadePaciente): boolean {
  if (atividade.respondidoEm) return false;
  const dias = (Date.now() - new Date(atividade.criadoEm).getTime()) / 86_400_000;
  return dias <= 14;
}

/** Link do questionário ou do jogo, conforme o tipo. */
export function linkDaAtividade(atividade: AtividadePaciente): string {
  if (atividade.tipo === "jogo") {
    return `/jogo/${atividade.escala}?c=${atividade.token}`;
  }
  return `/escala/${atividade.psicologoId}/${atividade.escala}?c=${atividade.token}`;
}
