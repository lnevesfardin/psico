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

export type EscalaSlug =
  | "cssrs"
  | "phq9"
  | "phq2"
  | "gad7"
  | "snap-iv"
  | "srq20"
  | "gds15"
  | "epds"
  | "dass21"
  | "pss10";

export type OpcaoLikert = { valor: number; label: string; descricao: string };

export type ItemLikert = {
  id: string;
  texto: string;
  dominio?: string;
  /** Só quando o item tem redação própria de resposta, diferente do resto
   *  da escala (ex.: cada pergunta da EPDS tem suas 4 frases específicas,
   *  ao contrário do PHQ-9/GAD-7, que repetem a mesma escala de frequência
   *  em todo item). Ausente, usa escala.opcoes — comportamento de sempre. */
  opcoes?: OpcaoLikert[];
  /**
   * Item escrito de forma positiva, onde a resposta "saudável" tem o maior
   * valor bruto (ex.: GDS-15 pergunta "está satisfeito com a vida?", em que
   * "sim" é o lado sem depressão) — sem inverter, esse item somaria ponto de
   * depressão pela resposta errada. Só afeta a PONTUAÇÃO, calculada depois
   * (ver calcularLikert); o paciente sempre vê a redação oficial e responde
   * com as opções literais, sem sinal nenhum de que o item é invertido.
   */
  reverso?: boolean;
};

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
  /**
   * Escalas com subescalas INDEPENDENTES, cada uma somada, multiplicada por
   * um fator próprio e classificada na própria tabela de gravidade (ex.:
   * DASS-21: Depressão/Ansiedade/Estresse, cada uma ×2, cada uma com 5
   * faixas). Item pertence a uma subescala pelo mesmo campo "dominio" usado
   * por "dominios" acima — os dois nunca coexistem na mesma escala.
   * Diferente de "dominios" (que combina tudo numa média + um sinal só),
   * aqui cada subescala é somada e relatada sem se combinar com as outras.
   */
  subescalas?: {
    chave: string;
    nome: string;
    multiplicador: number;
    faixas: FaixaLikert[];
  }[];
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

// Usada por SRQ-20 e GDS-15: as duas são de resposta binária (sim/não) no
// instrumento oficial, cada uma com pontuação por item — não frequência.
const OPCOES_SIM_NAO: OpcaoLikert[] = [
  { valor: 0, label: "Não", descricao: "Essa não é a sua situação" },
  { valor: 1, label: "Sim", descricao: "Essa é a sua situação" },
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

// Texto conferido em www.feis.unesp.br/Home/Instituicao/administracao/
// secaotecnicadesaude/srq_sem_escore.pdf (Seção Técnica de Saúde da UNESP,
// modelo em uso no serviço de saúde ocupacional da própria universidade) —
// instrumento da OMS, domínio público. Todos os itens somam igual (sim = 1
// ponto); nenhum é invertido. O item 13 no documento-fonte tem um erro de
// digitação óbvio ("não" pontuando [1] em vez de [0], único caso destoante
// dos outros 19 itens) — corrigido aqui como reverso: false igual ao resto,
// coerente com toda a literatura do instrumento (nenhum item do SRQ-20 é
// pontuado de forma invertida).
export const SRQ20: EscalaLikert = {
  tipo: "likert",
  slug: "srq20",
  nome: "SRQ-20 (rastreio de sofrimento psíquico)",
  descricaoCurta:
    "Self-Reporting Questionnaire — rastreio de transtorno mental comum (OMS), 20 perguntas de sim/não.",
  instrucao: "Responda às perguntas a seguir a respeito da sua saúde nas últimas semanas.",
  opcoes: OPCOES_SIM_NAO,
  itemAlertaRisco: "q17",
  itens: [
    { id: "q1", texto: "Tem dores de cabeça frequentes?" },
    { id: "q2", texto: "Tem falta de apetite?" },
    { id: "q3", texto: "Dorme mal?" },
    { id: "q4", texto: "Assusta-se com facilidade?" },
    { id: "q5", texto: "Tem tremores de mão?" },
    { id: "q6", texto: "Sente-se nervosa(o), tensa(o) ou preocupada(o)?" },
    { id: "q7", texto: "Tem má digestão?" },
    { id: "q8", texto: "Tem dificuldade para pensar com clareza?" },
    { id: "q9", texto: "Tem se sentido triste ultimamente?" },
    { id: "q10", texto: "Tem chorado mais do que de costume?" },
    {
      id: "q11",
      texto: "Encontra dificuldades para realizar com satisfação suas atividades diárias?",
    },
    { id: "q12", texto: "Tem dificuldades para tomar decisões?" },
    {
      id: "q13",
      texto: "Tem dificuldades no serviço (seu trabalho é penoso, causa sofrimento)?",
    },
    { id: "q14", texto: "É incapaz de desempenhar um papel útil em sua vida?" },
    { id: "q15", texto: "Tem perdido o interesse pelas coisas?" },
    { id: "q16", texto: "Sente-se uma pessoa inútil, sem préstimo?" },
    { id: "q17", texto: "Tem tido ideias de acabar com a vida?" },
    { id: "q18", texto: "Sente-se cansada(o) o tempo todo?" },
    { id: "q19", texto: "Tem sensações desagradáveis no estômago?" },
    { id: "q20", texto: "Cansa-se com facilidade?" },
  ],
  faixas: [
    { min: 0, max: 7, label: "Abaixo do ponto de corte" },
    { min: 8, max: 20, label: "Sugere possível transtorno mental comum" },
  ],
  corte: {
    valor: 8,
    rotulo: "Ponto de corte da validação brasileira (Mari & Williams, 1986) — considerar avaliação",
  },
};

// Texto e polaridade (itens invertidos 1, 5, 7, 11 e 13) conferidos em
// avaliacaogeriatrica.com/humor/gds15 — versão reduzida (15 itens) da
// Geriatric Depression Scale, validada no Brasil por Almeida & Almeida
// (1999). Itens de redação positiva ("satisfeito com a vida", "bom humor",
// "feliz", "maravilhoso estar vivo", "cheio de energia") são os únicos
// marcados reverso: true — nesses, "não" é o lado que soma ponto de
// depressão (ver ItemLikert.reverso em calcularLikert).
export const GDS15: EscalaLikert = {
  tipo: "likert",
  slug: "gds15",
  nome: "GDS-15 (depressão em idosos)",
  descricaoCurta:
    "Escala de Depressão Geriátrica, versão reduzida — rastreio de depressão em pessoas idosas, 15 perguntas de sim/não.",
  instrucao: "Escolha a resposta que melhor descreve como você tem se sentido na última semana.",
  opcoes: OPCOES_SIM_NAO,
  itens: [
    { id: "q1", texto: "Você está basicamente satisfeito(a) com sua vida?", reverso: true },
    { id: "q2", texto: "Você deixou muitos de seus interesses e atividades?" },
    { id: "q3", texto: "Você sente que sua vida está vazia?" },
    { id: "q4", texto: "Você se aborrece com frequência?" },
    { id: "q5", texto: "Você se sente de bom humor a maior parte do tempo?", reverso: true },
    { id: "q6", texto: "Você tem medo que algum mal vá lhe acontecer?" },
    { id: "q7", texto: "Você se sente feliz a maior parte do tempo?", reverso: true },
    { id: "q8", texto: "Você sente que sua situação não tem saída?" },
    { id: "q9", texto: "Você prefere ficar em casa a sair e fazer coisas novas?" },
    { id: "q10", texto: "Você se sente com mais problemas de memória do que a maioria?" },
    { id: "q11", texto: "Você acha maravilhoso estar vivo(a)?", reverso: true },
    { id: "q12", texto: "Você se sente um(a) inútil nas atuais circunstâncias?" },
    { id: "q13", texto: "Você se sente cheio(a) de energia?", reverso: true },
    { id: "q14", texto: "Você acha que sua situação é sem esperança?" },
    { id: "q15", texto: "Você sente que a maioria das pessoas está melhor que você?" },
  ],
  faixas: [
    { min: 0, max: 4, label: "Ausência de sintomas depressivos clinicamente relevantes" },
    { min: 5, max: 7, label: "Sintomas leves" },
    { min: 8, max: 9, label: "Sintomas moderados" },
    { min: 10, max: 15, label: "Sintomas graves" },
  ],
  corte: {
    valor: 5,
    rotulo: "5+ sugere sintomas depressivos relevantes (corte 5/6, Almeida & Almeida)",
  },
};

// Texto (adaptação em português, Areias et al. 1996), ordem de opções e
// regra de inversão (itens 3, 5, 6, 7, 8, 9 e 10) conferidos em
// antoniocarvalho.net/medkit/Ferramentas/DeprPosParto.html, cruzado com a
// descrição da regra de pontuação da validação brasileira. Reprodução da
// EPDS é livre para uso clínico/pesquisa citando os autores originais (Cox,
// Holden & Sagovsky, 1987, British Journal of Psychiatry) — sem alterar o
// instrumento. É a versão em português de Portugal, não uma tradução própria
// pro Brasil — se o psicólogo tiver a validação brasileira específica em
// mãos (ex.: Santos et al.), vale trocar pelo texto dela.
//
// Únicas mudanças em relação ao texto fonte: colocação de pronome
// (europeu "Tenho-me sentido" -> "Tenho me sentido", só ordem, sem trocar
// palavra) e "dantes"/"como" -> "antes"/"quanto" nos itens 1-2 (mesmo
// sentido, termo menos arcaico no Brasil). Revisão encontrou uma versão
// anterior deste arquivo com os itens 3 e 6 parafraseados em vez de
// transcritos — corrigido de volta pro texto exato da fonte.
//
// Item 10 pergunta sobre ideação de autolesão — mesmo tratamento do item 9
// do PHQ-9 (itemAlertaRisco). Cada item tem sua própria redação de resposta
// (item.opcoes), diferente do resto das escalas daqui: por isso não usa
// escala.opcoes compartilhado.
export const EPDS: EscalaLikert = {
  tipo: "likert",
  slug: "epds",
  nome: "EPDS (depressão pós-parto)",
  descricaoCurta:
    "Escala de Depressão Pós-Natal de Edimburgo — rastreio de depressão perinatal, 10 perguntas.",
  instrucao: "Selecione a resposta que mais se aproxima de como você tem se sentido nos últimos 7 dias.",
  // Nunca usada de fato (todo item tem opcoes próprio) — só preenche o tipo.
  opcoes: [],
  itemAlertaRisco: "q10",
  itens: [
    {
      id: "q1",
      texto: "Tenho sido capaz de me rir e ver o lado divertido das coisas",
      opcoes: [
        { valor: 0, label: "Tanto quanto antes", descricao: "" },
        { valor: 1, label: "Menos do que antes", descricao: "" },
        { valor: 2, label: "Muito menos do que antes", descricao: "" },
        { valor: 3, label: "Nunca", descricao: "" },
      ],
    },
    {
      id: "q2",
      texto: "Tenho tido esperança no futuro",
      opcoes: [
        { valor: 0, label: "Tanta quanto sempre tive", descricao: "" },
        { valor: 1, label: "Menos do que costumava ter", descricao: "" },
        { valor: 2, label: "Muito menos do que costumava ter", descricao: "" },
        { valor: 3, label: "Quase nenhuma", descricao: "" },
      ],
    },
    {
      id: "q3",
      texto: "Tenho me culpado sem necessidade quando as coisas correm mal",
      opcoes: [
        { valor: 3, label: "Sim, a maioria das vezes", descricao: "" },
        { valor: 2, label: "Sim, algumas vezes", descricao: "" },
        { valor: 1, label: "Raramente", descricao: "" },
        { valor: 0, label: "Não, nunca", descricao: "" },
      ],
    },
    {
      id: "q4",
      texto: "Tenho estado ansiosa(o) ou preocupada(o) sem motivo",
      opcoes: [
        { valor: 0, label: "Não, nunca", descricao: "" },
        { valor: 1, label: "Quase nunca", descricao: "" },
        { valor: 2, label: "Sim, por vezes", descricao: "" },
        { valor: 3, label: "Sim, muitas vezes", descricao: "" },
      ],
    },
    {
      id: "q5",
      texto: "Tenho me sentido com medo ou muito assustada(o), sem motivo",
      opcoes: [
        { valor: 3, label: "Sim, muitas vezes", descricao: "" },
        { valor: 2, label: "Sim, por vezes", descricao: "" },
        { valor: 1, label: "Não, raramente", descricao: "" },
        { valor: 0, label: "Não, nunca", descricao: "" },
      ],
    },
    {
      id: "q6",
      texto: "Tenho sentido que são coisas demais para mim",
      opcoes: [
        { valor: 3, label: "Sim, a maioria das vezes não consigo resolvê-las", descricao: "" },
        { valor: 2, label: "Sim, por vezes não tenho conseguido resolvê-las como antes", descricao: "" },
        { valor: 1, label: "Não, a maioria das vezes resolvo-as facilmente", descricao: "" },
        { valor: 0, label: "Não, resolvo-as tão bem como antes", descricao: "" },
      ],
    },
    {
      id: "q7",
      texto: "Tenho me sentido tão infeliz que durmo mal",
      opcoes: [
        { valor: 3, label: "Sim, quase sempre", descricao: "" },
        { valor: 2, label: "Sim, por vezes", descricao: "" },
        { valor: 1, label: "Raramente", descricao: "" },
        { valor: 0, label: "Não, nunca", descricao: "" },
      ],
    },
    {
      id: "q8",
      texto: "Tenho me sentido triste ou muito infeliz",
      opcoes: [
        { valor: 3, label: "Sim, quase sempre", descricao: "" },
        { valor: 2, label: "Sim, muitas vezes", descricao: "" },
        { valor: 1, label: "Raramente", descricao: "" },
        { valor: 0, label: "Não, nunca", descricao: "" },
      ],
    },
    {
      id: "q9",
      texto: "Tenho me sentido tão infeliz que choro",
      opcoes: [
        { valor: 3, label: "Sim, quase sempre", descricao: "" },
        { valor: 2, label: "Sim, muitas vezes", descricao: "" },
        { valor: 1, label: "Só às vezes", descricao: "" },
        { valor: 0, label: "Não, nunca", descricao: "" },
      ],
    },
    {
      id: "q10",
      texto: "Tive ideias de fazer mal a mim mesma(o)",
      opcoes: [
        { valor: 3, label: "Sim, muitas vezes", descricao: "" },
        { valor: 2, label: "Por vezes", descricao: "" },
        { valor: 1, label: "Muito raramente", descricao: "" },
        { valor: 0, label: "Nunca", descricao: "" },
      ],
    },
  ],
  faixas: [
    { min: 0, max: 8, label: "Depressão improvável" },
    { min: 9, max: 11, label: "Depressão possível" },
    { min: 12, max: 30, label: "Depressão provável" },
  ],
  corte: { valor: 12, rotulo: "12+ sugere depressão provável — considerar avaliação" },
};

// Texto, agrupamento por subescala e tabela de pontuação/classificação
// transcritos na íntegra de um PDF de aplicação da UFC (Grupo GAIPA,
// Faculdade de Medicina), que cita as duas referências originais:
// Lovibond & Lovibond (1995, instrumento original) e Vignola & Tucci (2014,
// adaptação/validação pro português do Brasil). Único documento desta leva
// de pesquisa com o texto completo, instruções, tabela de pontuação por
// subescala E tabela de classificação — sem precisar reconstruir nada.
//
// Cada subescala (Depressão/Ansiedade/Estresse) é somada e multiplicada por
// 2 de forma independente, com sua própria faixa de gravidade — ver
// EscalaLikert.subescalas. Nenhum item é invertido.
const OPCOES_DASS: OpcaoLikert[] = [
  { valor: 0, label: "Não se aplicou de maneira alguma", descricao: "" },
  { valor: 1, label: "Aplicou-se em algum grau, ou por pouco de tempo", descricao: "" },
  { valor: 2, label: "Aplicou-se em um grau considerável, ou por uma boa parte do tempo", descricao: "" },
  { valor: 3, label: "Aplicou-se muito, ou na maioria do tempo", descricao: "" },
];

export const DASS21: EscalaLikert = {
  tipo: "likert",
  slug: "dass21",
  nome: "DASS-21 (depressão, ansiedade e estresse)",
  descricaoCurta:
    "Rastreio conjunto de depressão, ansiedade e estresse — 21 afirmações, três resultados independentes.",
  instrucao:
    "Leia cada afirmação e escolha o quanto ela se aplicou a você durante a última semana.",
  opcoes: OPCOES_DASS,
  itens: [
    { id: "q1", texto: "Achei difícil me acalmar", dominio: "estresse" },
    { id: "q2", texto: "Senti minha boca seca", dominio: "ansiedade" },
    { id: "q3", texto: "Não consegui vivenciar nenhum sentimento positivo", dominio: "depressao" },
    {
      id: "q4",
      texto:
        "Tive dificuldade em respirar em alguns momentos (ex.: respiração ofegante, falta de ar, sem ter feito nenhum esforço físico)",
      dominio: "ansiedade",
    },
    { id: "q5", texto: "Achei difícil ter iniciativa para fazer as coisas", dominio: "depressao" },
    { id: "q6", texto: "Tive a tendência de reagir de forma exagerada às situações", dominio: "estresse" },
    { id: "q7", texto: "Senti tremores (ex.: nas mãos)", dominio: "ansiedade" },
    { id: "q8", texto: "Senti que estava sempre nervosa(o)", dominio: "estresse" },
    {
      id: "q9",
      texto: "Preocupei-me com situações em que eu pudesse entrar em pânico e parecesse ridícula(o)",
      dominio: "ansiedade",
    },
    { id: "q10", texto: "Senti que não tinha nada a desejar", dominio: "depressao" },
    { id: "q11", texto: "Senti-me agitada(o)", dominio: "estresse" },
    { id: "q12", texto: "Achei difícil relaxar", dominio: "estresse" },
    { id: "q13", texto: "Senti-me depressiva(o) e sem ânimo", dominio: "depressao" },
    {
      id: "q14",
      texto: "Fui intolerante com as coisas que me impediam de continuar o que eu estava fazendo",
      dominio: "estresse",
    },
    { id: "q15", texto: "Senti que ia entrar em pânico", dominio: "ansiedade" },
    { id: "q16", texto: "Não consegui me entusiasmar com nada", dominio: "depressao" },
    { id: "q17", texto: "Senti que não tinha valor como pessoa", dominio: "depressao" },
    { id: "q18", texto: "Senti que estava um pouco emotiva(o)/sensível demais", dominio: "estresse" },
    {
      id: "q19",
      texto:
        "Sabia que meu coração estava alterado mesmo não tendo feito nenhum esforço físico (ex.: aumento da frequência cardíaca, disritmia cardíaca)",
      dominio: "ansiedade",
    },
    { id: "q20", texto: "Senti medo sem motivo", dominio: "ansiedade" },
    { id: "q21", texto: "Senti que a vida não tinha sentido", dominio: "depressao" },
  ],
  // Não pontuado por total único — ver calcularLikert (subescalas).
  faixas: [],
  corte: { valor: 0, rotulo: "Ver classificação por subescala (Depressão/Ansiedade/Estresse) abaixo" },
  subescalas: [
    {
      chave: "depressao",
      nome: "Depressão",
      multiplicador: 2,
      faixas: [
        { min: 0, max: 9, label: "Normal" },
        { min: 10, max: 13, label: "Leve" },
        { min: 14, max: 20, label: "Moderado" },
        { min: 21, max: 27, label: "Severo" },
        { min: 28, max: 42, label: "Extremamente severo" },
      ],
    },
    {
      chave: "ansiedade",
      nome: "Ansiedade",
      multiplicador: 2,
      faixas: [
        { min: 0, max: 7, label: "Normal" },
        { min: 8, max: 9, label: "Leve" },
        { min: 10, max: 14, label: "Moderado" },
        { min: 15, max: 19, label: "Severo" },
        { min: 20, max: 42, label: "Extremamente severo" },
      ],
    },
    {
      chave: "estresse",
      nome: "Estresse",
      multiplicador: 2,
      faixas: [
        { min: 0, max: 14, label: "Normal" },
        { min: 15, max: 18, label: "Leve" },
        { min: 19, max: 25, label: "Moderado" },
        { min: 26, max: 33, label: "Severo" },
        { min: 34, max: 42, label: "Extremamente severo" },
      ],
    },
  ],
};

// Texto cruzado entre duas fontes independentes: a tradução em português
// hospedada no site do próprio laboratório de Sheldon Cohen (CMU,
// stress-immunity-disease-lab), e o instrumento distribuído pelo autor da
// validação brasileira (Prof. Dr. Rodrigo Siqueira Reis, GPAQ — Reis, Hino
// & Rodriguez-Añez, "Perceived Stress Scale: Reliability and Validity Study
// in Brazil"). As duas concordam nos itens invertidos (4, 5, 7 e 8) e no
// conteúdo de cada pergunta — o texto dos itens usado aqui é o da versão
// brasileira (GPAQ); as opções de resposta seguem a sequência mais clara
// semanticamente (a versão do GPAQ tem "Pouco Frequente" na posição 3 de 5,
// que soa contraditório com a ordem crescente — a versão da CMU usa
// "Frequentemente" no lugar, adotada aqui).
//
// Diferente das outras escalas daqui, a PSS-10 não tem corte diagnóstico
// oficial — o próprio documento da validação brasileira diz isso
// explicitamente ("não é uma medida critério-concorrente") e recomenda
// tratar o resultado como contínuo, comparando com tabela normativa em vez
// de um ponto de corte. As faixas abaixo são a referência descritiva mais
// citada (não veio da validação brasileira, é de uso informal comum), e o
// rótulo do corte deixa essa diferença explícita.
const OPCOES_PSS: OpcaoLikert[] = [
  { valor: 0, label: "Nunca", descricao: "" },
  { valor: 1, label: "Quase nunca", descricao: "" },
  { valor: 2, label: "Às vezes", descricao: "" },
  { valor: 3, label: "Frequentemente", descricao: "" },
  { valor: 4, label: "Muito frequentemente", descricao: "" },
];

export const PSS10: EscalaLikert = {
  tipo: "likert",
  slug: "pss10",
  nome: "PSS-10 (estresse percebido)",
  descricaoCurta:
    "Escala de Estresse Percebido — mede o quanto a vida tem parecido imprevisível, incontrolável ou sobrecarregada no último mês.",
  instrucao:
    "Para cada pergunta, indique com que frequência você se sentiu ou pensou dessa forma durante o último mês.",
  opcoes: OPCOES_PSS,
  itens: [
    {
      id: "q1",
      texto: "Com que frequência você ficou aborrecida(o) por causa de algo que aconteceu inesperadamente?",
    },
    {
      id: "q2",
      texto: "Com que frequência você sentiu que foi incapaz de controlar coisas importantes na sua vida?",
    },
    { id: "q3", texto: "Com que frequência você esteve nervosa(o) ou estressada(o)?" },
    {
      id: "q4",
      texto: "Com que frequência você esteve confiante em sua capacidade de lidar com seus problemas pessoais?",
      reverso: true,
    },
    {
      id: "q5",
      texto: "Com que frequência você sentiu que as coisas aconteceram da maneira que você esperava?",
      reverso: true,
    },
    {
      id: "q6",
      texto: "Com que frequência você achou que não conseguiria lidar com todas as coisas que tinha para fazer?",
    },
    {
      id: "q7",
      texto: "Com que frequência você foi capaz de controlar irritações na sua vida?",
      reverso: true,
    },
    {
      id: "q8",
      texto: "Com que frequência você sentiu que todos os aspectos da sua vida estavam sob controle?",
      reverso: true,
    },
    {
      id: "q9",
      texto: "Com que frequência você esteve brava(o) por causa de coisas que estiveram fora do seu controle?",
    },
    {
      id: "q10",
      texto:
        "Com que frequência você sentiu que os problemas se acumularam tanto que você não conseguiria resolvê-los?",
    },
  ],
  faixas: [
    { min: 0, max: 13, label: "Nível de estresse percebido baixo" },
    { min: 14, max: 26, label: "Nível de estresse percebido moderado" },
    { min: 27, max: 40, label: "Nível de estresse percebido alto" },
  ],
  corte: {
    valor: 27,
    rotulo:
      "Referência informal, não corte diagnóstico — a PSS-10 não tem ponto de corte oficial; melhor interpretada de forma contínua",
  },
};

export const ESCALAS_DISPONIVEIS: Escala[] = [
  CSSRS,
  PHQ9,
  PHQ2,
  GAD7,
  SNAP_IV,
  SRQ20,
  GDS15,
  EPDS,
  DASS21,
  PSS10,
];

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
  {
    categoria: "Ansiedade, estresse e trauma",
    sigla: "SPIN",
    nome: "Social Phobia Inventory",
    motivo:
      "Achamos as opções de resposta (0-4, nada a extremamente) e o corte (6+) na validação brasileira (Osório et al., 2004), mas não os 17 itens completos — só resumos que citam o instrumento sem reproduzi-lo.",
  },
  {
    categoria: "Ansiedade, estresse e trauma",
    sigla: "PCL-5",
    nome: "PTSD Checklist for DSM-5",
    motivo:
      "Achamos as opções de resposta (0-4) e o corte (36+) na validação brasileira, mas não os 20 itens completos. A pontuação clínica também exige separar cada item nos 4 grupos de critério do DSM-5 (reexperiência/evitação/cognições/hiperativação) — teria que vir junto com o texto pra não errar essa separação.",
  },
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
  /** Ver EscalaLikert.subescalas — cada subescala já vem com o total (soma
   *  x multiplicador) e a própria faixa de gravidade, sem se combinar com
   *  as outras. */
  porSubescala?: { nome: string; total: number; faixa: string; elevado: boolean }[];
};

/** Maior valor de pontuação que uma das opções de resposta pode valer —
 *  usado pra inverter item de redação positiva (ver ItemLikert.reverso). */
function valorMaximoOpcoes(opcoes: OpcaoLikert[]): number {
  return opcoes.reduce((max, o) => Math.max(max, o.valor), 0);
}

/**
 * Pontos que este item realmente contribui pra soma. Item comum: pontos =
 * resposta bruta. Item reverso (ex.: GDS-15 "está satisfeito com a vida?",
 * em que "sim" é o lado sem depressão): pontos = valorMáximo - resposta
 * bruta — sem essa inversão, responder o lado saudável desses itens somaria
 * ponto de depressão pela resposta errada.
 *
 * A pontuação é a única coisa que este cálculo decide: o paciente sempre
 * respondeu com a redação e as opções oficiais do item (ver escala-wizard),
 * sem nenhuma indicação visual de que o item é invertido.
 */
function pontosDoItem(
  escala: EscalaLikert,
  item: ItemLikert,
  respostas: RespostaLikert
): number {
  const bruto = respostas[item.id] ?? 0;
  if (!item.reverso) return bruto;
  return valorMaximoOpcoes(item.opcoes ?? escala.opcoes) - bruto;
}

export function calcularLikert(
  escala: EscalaLikert,
  respostas: RespostaLikert
): ResultadoLikert {
  const total = escala.itens.reduce(
    (soma, item) => soma + pontosDoItem(escala, item, respostas),
    0
  );

  if (escala.dominios) {
    // "6+ itens" é por domínio (convenção DSM-5/SNAP-IV: 6 de 9 itens do
    // MESMO domínio), não uma contagem somada entre desatenção e
    // hiperatividade — senão 3+3 itens elevados em domínios diferentes
    // (nenhum perto de 6/9 isoladamente) sinalizaria como falso positivo.
    const porDominioCompleto = escala.dominios.map((dominio) => {
      const itensDominio = escala.itens.filter((i) => i.dominio === dominio.chave);
      const soma = itensDominio.reduce(
        (acc, item) => acc + pontosDoItem(escala, item, respostas),
        0
      );
      const elevados = itensDominio.filter(
        (item) => pontosDoItem(escala, item, respostas) >= 2
      ).length;
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

  if (escala.subescalas) {
    // Cada subescala é somada e classificada SOZINHA (ver comentário em
    // EscalaLikert.subescalas) — "elevado" (faixa "Moderado" em diante, ou
    // seja índice 2 de 5) decide o tom mostrado ao psicólogo, mas nunca se
    // combina num único total: a DASS-21 não tem um "escore geral", tem três.
    const porSubescala = escala.subescalas.map((sub) => {
      const itensSub = escala.itens.filter((i) => i.dominio === sub.chave);
      const somaBruta = itensSub.reduce(
        (acc, item) => acc + pontosDoItem(escala, item, respostas),
        0
      );
      const totalSub = somaBruta * sub.multiplicador;
      const faixaSub = sub.faixas.find((f) => totalSub >= f.min && totalSub <= f.max);
      const indice = faixaSub ? sub.faixas.indexOf(faixaSub) : -1;
      return {
        nome: sub.nome,
        total: totalSub,
        faixa: faixaSub?.label ?? "—",
        elevado: indice >= 2,
      };
    });
    return {
      total: porSubescala.reduce((acc, s) => acc + s.total, 0),
      faixa: porSubescala.map((s) => `${s.nome}: ${s.faixa}`).join(" · "),
      alertaRisco: false,
      porSubescala,
    };
  }

  const faixa = escala.faixas.find((f) => total >= f.min && total <= f.max);
  const itemRisco = escala.itens.find((i) => i.id === escala.itemAlertaRisco);
  const alertaRisco = itemRisco
    ? pontosDoItem(escala, itemRisco, respostas) >= 1
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
