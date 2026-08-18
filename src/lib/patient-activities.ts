import type { SupabaseClient } from "@supabase/supabase-js";
import type { EscalaSlug } from "@/lib/escalas";

/**
 * Espaço Interativo do paciente: as atividades que o psicólogo dele enviou.
 *
 * A fonte é convites_escala — o mesmo convite que hoje o psicólogo copia e
 * manda por WhatsApp. Aqui ele também aparece na área do paciente, então
 * quem tem conta não depende de achar o link antigo na conversa.
 */

export type AtividadePaciente = {
  token: string;
  escala: EscalaSlug;
  psicologoId: string;
  psicologoNome: string;
  criadoEm: string;
  respondidoEm: string | null;
};

type AtividadeRow = {
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
    token: row.token,
    escala: row.escala as EscalaSlug,
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
export type ActivityThemeColor = "roxo" | "azul" | "verde" | "laranja" | "sobrio";

export type ActivityIconType = "heart" | "brain" | "smile" | "shield";

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
};

export function apresentacaoDa(escala: EscalaSlug): ActivityPresentation | null {
  return APRESENTACAO[escala] ?? null;
}

/** Enviada nos últimos 14 dias e ainda sem resposta. */
export function ehNovidade(atividade: AtividadePaciente): boolean {
  if (atividade.respondidoEm) return false;
  const dias = (Date.now() - new Date(atividade.criadoEm).getTime()) / 86_400_000;
  return dias <= 14;
}

/** Link do questionário — o mesmo que o psicólogo copiaria em Meu Link. */
export function linkDaAtividade(atividade: AtividadePaciente): string {
  return `/escala/${atividade.psicologoId}/${atividade.escala}?c=${atividade.token}`;
}
