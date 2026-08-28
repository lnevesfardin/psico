/**
 * Escalas de rastreio disponíveis para o link público (ver
 * src/app/escala/[psicologoId]/[slug] e src/app/dashboard/link/page.tsx).
 * Só instrumentos de domínio público / livres para reprodução clínica, com
 * o texto oficial de cada item já cadastrado — ver ESCALAS_INDISPONIVEIS
 * pro catálogo do que falta (e o motivo de cada um) e
 * TESTES_RESTRITOS_SATEPSI pros testes de uso exclusivo de psicólogo, que
 * nunca vão entrar aqui (aplicação regulada, só por sistema credenciado).
 *
 * São só rastreio, não diagnóstico — cada escala carrega essa mensagem na
 * própria "instrucao" e o resultado nunca é mostrado a quem responde (só ao
 * psicólogo, na aba de respostas).
 */

export type EscalaSlug = "cssrs" | "phq9" | "phq2" | "gad7" | "snap-iv";

export type OpcaoLikert = { valor: number; label: string; descricao: string };

export type ItemLikert = { id: string; texto: string; dominio?: string };

export type FaixaLikert = { min: number; max: number; label: string };

export type EscalaLikert = {
  tipo: "likert";
  slug: EscalaSlug;
  nome: string;
  descricaoCurta: string;
  instrucao: string;
  opcoes: OpcaoLikert[];
  itens: ItemLikert[];
  /** id do item cuja resposta >= 1 dispara alerta de risco (ex.: PHQ-9 item 9). */
  itemAlertaRisco?: string;
  /** Item extra que não entra na soma (ex.: pergunta de funcionalidade do PHQ-9). */
  itemExtra?: { id: string; texto: string; opcoes: OpcaoLikert[] };
  faixas: FaixaLikert[];
  corte: { valor: number; rotulo: string };
  /** Só para escalas pontuadas por domínio (ex.: SNAP-IV), não por total simples. */
  dominios?: { chave: string; nome: string }[];
};

export type ItemCssrs = { id: string; texto: string };

export type EscalaCssrs = {
  tipo: "cssrs";
  slug: "cssrs";
  nome: string;
  descricaoCurta: string;
  instrucao: string;
  itens: ItemCssrs[];
};

export type Escala = EscalaLikert | EscalaCssrs;

export type RespostaLikert = Record<string, number>;
export type RespostaCssrs = Record<string, boolean>;

const OPCOES_FREQUENCIA: OpcaoLikert[] = [
  { valor: 0, label: "Nenhuma vez", descricao: "Não aconteceu nos últimos 14 dias" },
  { valor: 1, label: "Alguns dias", descricao: "Aconteceu em alguns momentos" },
  { valor: 2, label: "Mais da metade dos dias", descricao: "Aconteceu com frequência" },
  { valor: 3, label: "Quase todos os dias", descricao: "Aconteceu de forma intensa" },
];

const OPCOES_SNAP: OpcaoLikert[] = [
  { valor: 0, label: "Nem um pouco", descricao: "Não acontece" },
  { valor: 1, label: "Só um pouco", descricao: "Acontece raramente" },
  { valor: 2, label: "Bastante", descricao: "Acontece com frequência" },
  { valor: 3, label: "Demais", descricao: "Acontece o tempo todo" },
];

export const CSSRS: EscalaCssrs = {
  tipo: "cssrs",
  slug: "cssrs",
  nome: "C-SSRS (risco suicida)",
  descricaoCurta: "Escala Columbia de gravidade do risco de suicídio (versão Screen, 6 itens).",
  instrucao:
    "As perguntas 1 a 5 se referem ao último mês. A pergunta 6 se refere à vida toda e aos últimos 3 meses.",
  itens: [
    { id: "q1", texto: "Desejou estar morta(o) ou poder dormir e não acordar?" },
    { id: "q2", texto: "Teve pensamentos, mesmo que passageiros, de se matar?" },
    { id: "q3", texto: "Pensou em como poderia fazer isso (algum método)?" },
    {
      id: "q4",
      texto: "Teve esses pensamentos e alguma intenção de agir sobre eles?",
    },
    {
      id: "q5",
      texto:
        "Começou a definir ou já definiu detalhes de um plano, com intenção de levá-lo adiante?",
    },
    {
      id: "q6",
      texto:
        "Comportamento: alguma vez fez algo, começou a fazer, ou se preparou para acabar com a própria vida?",
    },
  ],
};

const PHQ9_ITENS: ItemLikert[] = [
  { id: "q1", texto: "Pouco interesse ou pouco prazer em fazer as coisas" },
  { id: "q2", texto: "Se sentir para baixo, deprimida(o) ou sem perspectiva" },
  {
    id: "q3",
    texto: "Dificuldade para pegar no sono, permanecer dormindo, ou dormir demais",
  },
  { id: "q4", texto: "Se sentir cansada(o) ou com pouca energia" },
  { id: "q5", texto: "Falta de apetite ou comer em excesso" },
  {
    id: "q6",
    texto:
      "Se sentir mal consigo mesma(o) — sentir-se um fracasso ou que decepcionou a família ou a si mesma(o)",
  },
  {
    id: "q7",
    texto: "Dificuldade para se concentrar (ler, assistir algo, tarefas escolares)",
  },
  {
    id: "q8",
    texto:
      "Lentidão para se mover ou falar a ponto de outros perceberem — ou o oposto, estar tão agitada(o) que se mexe muito mais que o normal",
  },
  {
    id: "q9",
    texto: "Pensar que seria melhor estar morta(o) ou em se ferir de alguma maneira",
  },
];

export const PHQ9: EscalaLikert = {
  tipo: "likert",
  slug: "phq9",
  nome: "PHQ-9 (depressão)",
  descricaoCurta: "Rastreio de depressão — versão brasileira validada, adequada a partir de ~13 anos.",
  instrucao: "Nas últimas duas semanas, com que frequência você foi incomodada(o) por algum dos problemas abaixo?",
  opcoes: OPCOES_FREQUENCIA,
  itemAlertaRisco: "q9",
  itemExtra: {
    id: "funcionalidade",
    texto: "Se você marcou algum problema, o quanto ele dificultou seu dia a dia — estudos, casa, convivência?",
    opcoes: [
      { valor: 0, label: "Nada", descricao: "Não dificultou" },
      { valor: 1, label: "Um pouco", descricao: "Dificultou um pouco" },
      { valor: 2, label: "Muito", descricao: "Dificultou bastante" },
      { valor: 3, label: "Extremamente", descricao: "Dificultou extremamente" },
    ],
  },
  itens: PHQ9_ITENS,
  faixas: [
    { min: 0, max: 4, label: "Mínima" },
    { min: 5, max: 9, label: "Leve" },
    { min: 10, max: 14, label: "Moderada" },
    { min: 15, max: 19, label: "Moderadamente grave" },
    { min: 20, max: 27, label: "Grave" },
  ],
  corte: { valor: 10, rotulo: "Provável episódio depressivo maior" },
};

// Os 2 primeiros itens do PHQ-9 (mesmo texto oficial, já usado ali) são,
// eles mesmos, o instrumento validado PHQ-2 — não uma aproximação. Corte ≥3
// é o ponto de corte publicado pra ele.
export const PHQ2: EscalaLikert = {
  tipo: "likert",
  slug: "phq2",
  nome: "PHQ-2 (rastreio rápido de depressão)",
  descricaoCurta:
    "Ultra-rastreio de depressão em 2 perguntas — indicado pra triagem rápida antes do PHQ-9 completo.",
  instrucao: "Nas últimas duas semanas, com que frequência você foi incomodada(o) por algum dos problemas abaixo?",
  opcoes: OPCOES_FREQUENCIA,
  itens: [PHQ9_ITENS[0], PHQ9_ITENS[1]],
  faixas: [
    { min: 0, max: 2, label: "Rastreio negativo" },
    { min: 3, max: 6, label: "Rastreio positivo" },
  ],
  corte: { valor: 3, rotulo: "Sugere possível quadro depressivo — aplicar o PHQ-9 completo" },
};

export const GAD7: EscalaLikert = {
  tipo: "likert",
  slug: "gad7",
  nome: "GAD-7 (ansiedade)",
  descricaoCurta: "Rastreio de ansiedade — versão brasileira validada, para adolescentes e adultos.",
  instrucao: "Nas últimas duas semanas, com que frequência você foi incomodada(o) por algum dos problemas abaixo?",
  opcoes: OPCOES_FREQUENCIA,
  itens: [
    { id: "q1", texto: "Sentir-se nervosa(o), ansiosa(o) ou no limite" },
    { id: "q2", texto: "Não ser capaz de impedir ou controlar as preocupações" },
    { id: "q3", texto: "Preocupar-se muito com diversas coisas" },
    { id: "q4", texto: "Dificuldade para relaxar" },
    {
      id: "q5",
      texto: "Ficar tão agitada(o) que se torna difícil permanecer sentada(o)",
    },
    { id: "q6", texto: "Ficar facilmente aborrecida(o) ou irritada(o)" },
    { id: "q7", texto: "Sentir medo como se algo horrível fosse acontecer" },
  ],
  faixas: [
    { min: 0, max: 4, label: "Mínima" },
    { min: 5, max: 9, label: "Leve" },
    { min: 10, max: 14, label: "Moderada" },
    { min: 15, max: 21, label: "Grave" },
  ],
  corte: { valor: 10, rotulo: "Provável Transtorno de Ansiedade Generalizada" },
};

export const SNAP_IV: EscalaLikert = {
  tipo: "likert",
  slug: "snap-iv",
  nome: "SNAP-IV (TDAH)",
  descricaoCurta: "Rastreio de desatenção e hiperatividade/impulsividade — versão brasileira validada.",
  instrucao:
    "Com que frequência a criança/adolescente apresenta os comportamentos abaixo?",
  opcoes: OPCOES_SNAP,
  dominios: [
    { chave: "desatencao", nome: "Desatenção" },
    { chave: "hiperatividade", nome: "Hiperatividade/Impulsividade" },
  ],
  itens: [
    {
      id: "q1",
      texto: "Deixa de prestar atenção a detalhes ou comete erros por descuido",
      dominio: "desatencao",
    },
    {
      id: "q2",
      texto: "Tem dificuldade de manter a atenção em tarefas ou atividades",
      dominio: "desatencao",
    },
    {
      id: "q3",
      texto: "Parece não escutar quando lhe dirigem a palavra",
      dominio: "desatencao",
    },
    {
      id: "q4",
      texto: "Não segue instruções até o fim e não termina tarefas ou deveres",
      dominio: "desatencao",
    },
    {
      id: "q5",
      texto: "Tem dificuldade para organizar tarefas e atividades",
      dominio: "desatencao",
    },
    {
      id: "q6",
      texto:
        "Evita ou reluta em envolver-se em tarefas que exijam esforço mental prolongado",
      dominio: "desatencao",
    },
    { id: "q7", texto: "Perde coisas necessárias para tarefas/atividades", dominio: "desatencao" },
    { id: "q8", texto: "Distrai-se facilmente com estímulos externos", dominio: "desatencao" },
    {
      id: "q9",
      texto: "É esquecida(o) em relação a atividades cotidianas",
      dominio: "desatencao",
    },
    {
      id: "q10",
      texto: "Mexe as mãos/pés ou se remexe na cadeira",
      dominio: "hiperatividade",
    },
    {
      id: "q11",
      texto: "Levanta-se em situações em que se espera que permaneça sentada(o)",
      dominio: "hiperatividade",
    },
    {
      id: "q12",
      texto:
        "Sente-se inquieta(o) / corre ou sobe nas coisas em situações inapropriadas",
      dominio: "hiperatividade",
    },
    {
      id: "q13",
      texto: "Tem dificuldade de se envolver em atividades de lazer de forma silenciosa",
      dominio: "hiperatividade",
    },
    {
      id: "q14",
      texto: 'Está "a mil" ou age como se estivesse "a todo vapor"',
      dominio: "hiperatividade",
    },
    { id: "q15", texto: "Fala em excesso", dominio: "hiperatividade" },
    {
      id: "q16",
      texto: "Responde de forma precipitada, antes de a pergunta ser concluída",
      dominio: "hiperatividade",
    },
    { id: "q17", texto: "Tem dificuldade para aguardar sua vez", dominio: "hiperatividade" },
    {
      id: "q18",
      texto: "Interrompe ou se intromete em conversas/atividades",
      dominio: "hiperatividade",
    },
  ],
  // Não pontuado por total simples — ver calcularLikert (média por domínio).
  faixas: [],
  corte: { valor: 2, rotulo: "Média ≥ 2 por domínio sinaliza sintomatologia relevante" },
};

export const ESCALAS_DISPONIVEIS: Escala[] = [CSSRS, PHQ9, PHQ2, GAD7, SNAP_IV];

export type EscalaIndisponivel = {
  categoria: string;
  sigla: string;
  nome: string;
  motivo: string;
};

// Repetida em vários itens de ESCALAS_INDISPONIVEIS: são instrumentos de
// domínio público/envio livre (não exigem psicólogo pra aplicar, diferente
// da lista de TESTES_RESTRITOS_SATEPSI abaixo), mas fabricar o enunciado de
// cada item e a tabela de pontos de corte de memória arriscaria tanto os
// direitos do instrumento quanto — o que pesa mais — a exatidão da
// pontuação devolvida pra um paciente de verdade. Mesmo cuidado que já
// existia aqui só pra escala de trauma, agora estendido pra lista inteira.
const MOTIVO_FALTA_TEXTO_OFICIAL =
  "De domínio público, mas o texto oficial de cada item e a tabela de pontos de corte ainda não foram cadastrados aqui. Colando o instrumento validado (idealmente a versão em português já usada no Brasil), dá pra implementar.";

// Estas, além do texto oficial, dependem de autorização/registro do próprio
// detentor antes de qualquer reprodução (OMS, para o WHOQOL; autor original,
// para as demais) — um passo a mais que os itens acima.
const MOTIVO_REQUER_AUTORIZACAO =
  "Depende de autorização/registro junto ao detentor dos direitos (não é só colar o texto) além da tabela de pontos de corte — ainda não solicitado.";

/**
 * Escalas de rastreio de domínio público que o pedido original trouxe mas
 * que ainda não têm o texto oficial dos itens cadastrado em ESCALAS_DISPONIVEIS
 * — mesmo padrão que já existia só para a escala de trauma, agora abrangendo
 * a lista inteira. Aparecem no seletor como "em breve", cada uma com seu
 * motivo, em vez de sumirem silenciosamente do catálogo.
 */
export const ESCALAS_INDISPONIVEIS: EscalaIndisponivel[] = [
  { categoria: "Depressão e humor", sigla: "EPDS", nome: "Edinburgh Postnatal Depression Scale (depressão pós-parto)", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Depressão e humor", sigla: "GDS-15", nome: "Geriatric Depression Scale (depressão em idosos)", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Ansiedade, estresse e trauma", sigla: "DASS-21", nome: "Depression, Anxiety and Stress Scale", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Ansiedade, estresse e trauma", sigla: "PSS-10", nome: "Perceived Stress Scale", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Ansiedade, estresse e trauma", sigla: "SPIN", nome: "Social Phobia Inventory", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Ansiedade, estresse e trauma", sigla: "PCL-5", nome: "PTSD Checklist for DSM-5", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  {
    categoria: "Ansiedade, estresse e trauma",
    sigla: "CRIES-13 / CTQ",
    nome: "Escala de Trauma",
    motivo:
      "CRIES-13 é gratuito (childrenandwar.org); o CTQ tem direitos autorais explícitos. Falta cadastrar o texto oficial de qualquer um dos dois.",
  },
  { categoria: "Neurodesenvolvimento", sigla: "ASRS-18", nome: "Adult Self-Report Scale — TDAH em adultos", motivo: MOTIVO_REQUER_AUTORIZACAO },
  { categoria: "Neurodesenvolvimento", sigla: "AQ-10", nome: "Autism-Spectrum Quotient (10 itens)", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Neurodesenvolvimento", sigla: "CAT-Q", nome: "Camouflaging Autistic Traits Questionnaire", motivo: MOTIVO_REQUER_AUTORIZACAO },
  { categoria: "Neurodesenvolvimento", sigla: "RAADS-R", nome: "Ritvo Autism Asperger Diagnostic Scale", motivo: MOTIVO_REQUER_AUTORIZACAO },
  { categoria: "Saúde geral e qualidade de vida", sigla: "SRQ-20", nome: "Self-Reporting Questionnaire-20", motivo: MOTIVO_FALTA_TEXTO_OFICIAL },
  { categoria: "Saúde geral e qualidade de vida", sigla: "WHOQOL-BREF", nome: "Qualidade de vida (OMS, versão abreviada)", motivo: MOTIVO_REQUER_AUTORIZACAO },
  { categoria: "Saúde geral e qualidade de vida", sigla: "CORE-OM", nome: "Clinical Outcomes in Routine Evaluation", motivo: MOTIVO_REQUER_AUTORIZACAO },
];

export type TesteRestrito = { categoria: string; sigla: string; nome: string };

/**
 * Testes psicológicos de uso EXCLUSIVO de psicólogo (Lei 4.119/62), com
 * aplicação obrigatoriamente por sistema credenciado no SATEPSI (Vetor
 * Online, Pearson Clinical, Hogrefe etc.) — nunca por link avulso, nem por
 * PDF. Ficam listados aqui só como REFERÊNCIA dentro do painel, nunca como
 * opção de envio: montar um disparo próprio pra eles contornaria a própria
 * exigência regulatória que os torna restritos, além de reproduzir
 * instrumento comercial protegido por direitos autorais sem licença. A
 * aplicação de verdade continua na plataforma da editora de cada teste.
 */
export const TESTES_RESTRITOS_SATEPSI: TesteRestrito[] = [
  { categoria: "Escalas de Beck", sigla: "BDI-II", nome: "Inventário de Depressão de Beck" },
  { categoria: "Escalas de Beck", sigla: "BAI", nome: "Inventário de Ansiedade de Beck" },
  { categoria: "Escalas de Beck", sigla: "BHS", nome: "Escala de Desesperança de Beck" },
  { categoria: "Escalas de Beck", sigla: "BSS", nome: "Escala de Ideação Suicida de Beck" },
  { categoria: "Personalidade e tipologia", sigla: "BFP", nome: "Bateria Fatorial de Personalidade" },
  { categoria: "Personalidade e tipologia", sigla: "NEO-PI-R / NEO-FFI-R", nome: "Inventário de Personalidade NEO" },
  { categoria: "Personalidade e tipologia", sigla: "QUATI", nome: "Questionário de Avaliação Tipológica" },
  { categoria: "Personalidade e tipologia", sigla: "IFP-II", nome: "Inventário Fatorial de Personalidade" },
  { categoria: "Estresse e cognição operacional", sigla: "ISSL", nome: "Inventário de Sintomas de Stress de Lipp" },
  { categoria: "Estresse e cognição operacional", sigla: "BPA", nome: "Bateria de Psicodiagnóstico de Atenção" },
];

export function getEscala(slug: string): Escala | undefined {
  return ESCALAS_DISPONIVEIS.find((e) => e.slug === slug);
}

export type ResultadoLikert = {
  total: number;
  faixa: string;
  alertaRisco: boolean;
  porDominio?: { nome: string; media: number }[];
};

export function calcularLikert(
  escala: EscalaLikert,
  respostas: RespostaLikert
): ResultadoLikert {
  const total = escala.itens.reduce((soma, item) => soma + (respostas[item.id] ?? 0), 0);

  if (escala.dominios) {
    // "6+ itens" é por domínio (convenção DSM-5/SNAP-IV: 6 de 9 itens do
    // MESMO domínio), não uma contagem somada entre desatenção e
    // hiperatividade — senão 3+3 itens elevados em domínios diferentes
    // (nenhum perto de 6/9 isoladamente) sinalizaria como falso positivo.
    const porDominioCompleto = escala.dominios.map((dominio) => {
      const itensDominio = escala.itens.filter((i) => i.dominio === dominio.chave);
      const soma = itensDominio.reduce((acc, item) => acc + (respostas[item.id] ?? 0), 0);
      const elevados = itensDominio.filter((item) => (respostas[item.id] ?? 0) >= 2).length;
      const media = itensDominio.length > 0 ? soma / itensDominio.length : 0;
      return { nome: dominio.nome, media, sinalizadoDominio: media >= 2 || elevados >= 6 };
    });
    const sinalizado = porDominioCompleto.some((d) => d.sinalizadoDominio);
    return {
      total,
      faixa: sinalizado
        ? "Sintomatologia relevante — considerar investigação diagnóstica"
        : "Sem sinalização relevante neste rastreio",
      alertaRisco: false,
      porDominio: porDominioCompleto.map(({ nome, media }) => ({ nome, media })),
    };
  }

  const faixa = escala.faixas.find((f) => total >= f.min && total <= f.max);
  const alertaRisco = escala.itemAlertaRisco
    ? (respostas[escala.itemAlertaRisco] ?? 0) >= 1
    : false;

  return { total, faixa: faixa?.label ?? "—", alertaRisco };
}

export type NivelRiscoCssrs = "nenhum" | "moderado" | "alto" | "alto_iminente";

export type ResultadoCssrs = {
  nivel: NivelRiscoCssrs;
  rotulo: string;
  conduta: string;
};

export function calcularCssrs(respostas: RespostaCssrs): ResultadoCssrs {
  const q1 = Boolean(respostas.q1);
  const q2 = Boolean(respostas.q2);
  const q3 = Boolean(respostas.q3);
  const q4 = Boolean(respostas.q4);
  const q5 = Boolean(respostas.q5);
  const q6 = Boolean(respostas.q6);
  const q6UltimosTresMeses = Boolean(respostas.q6_3meses);

  if (q4 || q5 || (q6 && q6UltimosTresMeses)) {
    return {
      nivel: "alto_iminente",
      rotulo: "Risco alto / iminente",
      conduta:
        "Conduta de emergência: não deixar a pessoa sozinha, acionar responsáveis/rede de apoio, encaminhar a pronto-socorro, CAPS ou SAMU (192).",
    };
  }
  if (q3) {
    return {
      nivel: "alto",
      rotulo: "Risco alto",
      conduta:
        "Intensificar cuidados, considerar restrição de meios, articular rede de apoio e avaliação psiquiátrica.",
    };
  }
  if (q2) {
    return {
      nivel: "moderado",
      rotulo: "Risco pelo menos moderado",
      conduta: "Elaborar plano de segurança e manter monitoramento próximo.",
    };
  }
  return {
    nivel: "nenhum",
    rotulo: "Sem indicação de risco agudo neste rastreio",
    conduta: q1
      ? "Seguir acompanhamento de rotina — o desejo de não acordar (item 1) merece atenção clínica mesmo sem pensamento ativo de suicídio."
      : "Seguir acompanhamento de rotina.",
  };
}
