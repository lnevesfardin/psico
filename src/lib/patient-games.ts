/**
 * Catálogo do Espaço Interativo da área do paciente.
 *
 * Os dados aqui são de exemplo: a tela existe primeiro como interface, para
 * ser validada antes de ligar na fonte real. Quando ligar, o candidato natural
 * é o sistema de escalas que já existe no projeto (src/lib/escalas.ts +
 * convites_escala no schema.sql), que é exatamente "perguntas e respostas que
 * o psicólogo envia ao paciente" — ver o comentário no fim do arquivo.
 */

export type GameStatus = "new" | "in_progress" | "completed";

/**
 * Cor do banner como chave, e não como classe montada em tempo de execução:
 * o Tailwind gera CSS lendo o código-fonte, então `bg-${cor}-500` sai sem
 * estilo nenhum na tela. O mapa de classes fica em patient-game-card.tsx.
 */
export type GameThemeColor = "roxo" | "azul" | "verde" | "laranja" | "rosa";

export type GameIconType = "heart" | "brain" | "smile" | "star";

export interface PatientGame {
  id: string;
  title: string;
  description: string;
  /** Texto livre, exibido como está (ex.: "5-10 min"). */
  estimatedTime: string;
  isRecommended: boolean;
  status: GameStatus;
  tags: string[];
  themeColor: GameThemeColor;
  iconType: GameIconType;
}

export const PATIENT_GAMES: PatientGame[] = [
  {
    id: "termometro-emocoes",
    title: "Termômetro das Emoções",
    description:
      "Um espaço seguro para você perceber como as situações do dia a dia mexem com o que você sente — e dar nome a isso sem pressa.",
    estimatedTime: "5-10 min",
    isRecommended: true,
    status: "new",
    tags: ["Bem-estar", "Autoconhecimento"],
    themeColor: "roxo",
    iconType: "heart",
  },
  {
    id: "compreendendo-ansiedade",
    title: "Compreendendo a Ansiedade",
    description:
      "Você vai reconhecer os sinais que seu corpo dá antes da ansiedade crescer, no seu ritmo e sem respostas certas ou erradas.",
    estimatedTime: "8 min",
    isRecommended: true,
    status: "in_progress",
    tags: ["Ansiedade", "Autocuidado"],
    themeColor: "azul",
    iconType: "brain",
  },
  {
    id: "mapa-relacoes",
    title: "Mapa das Suas Relações",
    description:
      "Quem te acolhe, quem te cansa, quem você procura num dia difícil. Um exercício para enxergar sua rede de apoio com mais clareza.",
    estimatedTime: "10 min",
    isRecommended: true,
    status: "new",
    tags: ["Relacionamentos", "Autoconhecimento"],
    themeColor: "verde",
    iconType: "smile",
  },
  {
    id: "espelho-autoestima",
    title: "O Espelho Gentil",
    description:
      "Como você fala consigo mesmo quando erra? Aqui você experimenta trocar a cobrança por um jeito mais gentil de se olhar.",
    estimatedTime: "6 min",
    isRecommended: false,
    status: "new",
    tags: ["Autoestima", "Autocuidado"],
    themeColor: "rosa",
    iconType: "star",
  },
  {
    id: "rotina-sono",
    title: "Sua Noite de Sono",
    description:
      "Perguntas curtas sobre como têm sido suas noites, para vocês dois enxergarem juntos o que está atrapalhando seu descanso.",
    estimatedTime: "5 min",
    isRecommended: false,
    status: "new",
    tags: ["Sono", "Bem-estar"],
    themeColor: "laranja",
    iconType: "smile",
  },
  {
    id: "linha-do-tempo",
    title: "Linha do Tempo dos Bons Momentos",
    description:
      "Relembre situações em que você se sentiu bem e descubra o que elas têm em comum — costuma ser mais do que parece.",
    estimatedTime: "12 min",
    isRecommended: false,
    status: "completed",
    tags: ["Autoconhecimento", "Bem-estar"],
    themeColor: "roxo",
    iconType: "star",
  },
  {
    id: "limites-relacoes",
    title: "Dizer Não Sem Culpa",
    description:
      "Situações do cotidiano para você treinar onde ficam os seus limites e como comunicá-los sem sentir que decepcionou alguém.",
    estimatedTime: "9 min",
    isRecommended: false,
    status: "completed",
    tags: ["Relacionamentos", "Autoestima"],
    themeColor: "azul",
    iconType: "heart",
  },
  {
    id: "respiracao-guiada",
    title: "Pausa de Três Minutos",
    description:
      "Uma pausa guiada para os dias em que tudo aperta ao mesmo tempo. Pode repetir quantas vezes quiser.",
    estimatedTime: "3 min",
    isRecommended: false,
    status: "completed",
    tags: ["Ansiedade", "Autocuidado"],
    themeColor: "verde",
    iconType: "brain",
  },
];

/** Temas do filtro, derivados das tags em uso — nada de lista paralela. */
export function temasDisponiveis(jogos: PatientGame[]): string[] {
  return [...new Set(jogos.flatMap((j) => j.tags))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

/*
 * Para ligar no real depois: cada item viraria um convite de escala
 * (gerar_convite_escala no schema.sql) ou um novo tipo de atividade do
 * psicólogo, com "status" vindo de respostas_escala — completed quando existe
 * resposta daquele paciente. O formato desta interface foi escolhido para
 * aceitar essa origem sem mudar a tela.
 */
