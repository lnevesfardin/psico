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
  | "pss10"
  | "ocir"
  | "ybocs"
  | "aq10"
  | "ear"
  | "ecap";

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
  /**
   * Escala cujo item pontua 1 ou 0 conforme a resposta cair de um lado do
   * ponto médio, não pelo valor bruto (ex.: AQ-10 — "concordo" OU "discordo",
   * conforme o item, vale 1 ponto; o total 0-10 é o que tem ponto de corte
   * publicado, não a soma dos valores 0-3). A resposta bruta segue a escala
   * Likert de 4 pontos do instrumento; a binarização roda na pontuação,
   * depois de aplicar item.reverso (ver calcularLikert). Item cuja pontuação
   * (após reverso) for >= limiarBinario conta 1; senão, 0.
   */
  limiarBinario?: number;
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

// As 4 descrições falam só de FREQUÊNCIA, a mesma dimensão do rótulo — a
// versão anterior misturava frequência e intensidade na última opção
// ("Quase todos os dias" / "de forma intensa"), o que dava margem a
// confusão sobre o que estava sendo perguntado.
const OPCOES_FREQUENCIA: OpcaoLikert[] = [
  { valor: 0, label: "Nenhuma vez", descricao: "Não aconteceu nos últimos 14 dias" },
  { valor: 1, label: "Alguns dias", descricao: "Aconteceu em poucos dias, não com frequência" },
  { valor: 2, label: "Mais da metade dos dias", descricao: "Aconteceu na maioria dos dias" },
  { valor: 3, label: "Quase todos os dias", descricao: "Aconteceu com frequência, quase todo dia" },
];

const OPCOES_SNAP: OpcaoLikert[] = [
  { valor: 0, label: "Nem um pouco", descricao: "Não acontece" },
  { valor: 1, label: "Só um pouco", descricao: "Acontece raramente" },
  { valor: 2, label: "Bastante", descricao: "Acontece com frequência" },
  { valor: 3, label: "Demais", descricao: "Acontece o tempo todo" },
];

// Usada por SRQ-20 e GDS-15: as duas são de resposta binária (sim/não) no
// instrumento oficial, cada uma com pontuação por item — não frequência.
// Sem subtítulo: cada item já É uma pergunta de sim/não (ex.: "Tem dores de
// cabeça frequentes?"), então "Sim"/"Não" sozinhos já respondem com clareza
// — um subtítulo genérico tipo "essa é a sua situação" só reformularia a
// pergunta de um jeito estranho, igual pra qualquer uma das 35 perguntas
// diferentes que usam esta mesma lista. Mesmo critério já usado no C-SSRS
// (YesNoQuestion, em escala-wizard.tsx), que também não tem subtítulo.
const OPCOES_SIM_NAO: OpcaoLikert[] = [
  { valor: 0, label: "Não", descricao: "" },
  { valor: 1, label: "Sim", descricao: "" },
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

// OCI-R (Obsessive-Compulsive Inventory — Revised): Foa, Huppert, Leiberg,
// Langner, Kichic, Hajcak & Salkovskis (2002), Psychological Assessment
// 14(4):485-496. Tradução e adaptação para o português do Brasil: Souza,
// Foa, Meyer, Niederauer, Raffin & Cordioli (2008), Rev Bras Psiquiatr
// 30(1):42-46. Instrumento de uso livre para clínica e pesquisa (os autores
// autorizam a reprodução sem custo).
//
// RESSALVA: o texto dos 18 itens abaixo foi redigido a partir da versão
// canônica em inglês e da descrição da adaptação brasileira — não copiado
// de um documento oficial conferido item a item aqui. Com o instrumento
// validado (Souza et al., 2008) em mãos, vale substituir pela redação
// exata dele.
//
// 18 itens, 6 subescalas de 3 itens (Lavagem, Verificação, Ordem, Obsessão,
// Acumulação, Neutralização). Pontuação = soma simples, 0-72, sem item
// invertido. A composição por subescala fica só documentada: a OCI-R é,
// antes de tudo, um escore total com ponto de corte único (>= 21), e os
// ramos "dominios"/"subescalas" de calcularLikert trocariam essa lógica.
// Subescalas (item): Lavagem 5/11/17 · Verificação 2/8/14 · Ordem 3/9/15 ·
// Obsessão 6/12/18 · Acumulação 1/7/13 · Neutralização 4/10/16.
const OPCOES_OCIR: OpcaoLikert[] = [
  { valor: 0, label: "Nem um pouco", descricao: "" },
  { valor: 1, label: "Um pouco", descricao: "" },
  { valor: 2, label: "Moderadamente", descricao: "" },
  { valor: 3, label: "Muito", descricao: "" },
  { valor: 4, label: "Extremamente", descricao: "" },
];

export const OCIR: EscalaLikert = {
  tipo: "likert",
  slug: "ocir",
  nome: "OCI-R (sintomas obsessivo-compulsivos)",
  descricaoCurta:
    "Inventário Obsessivo-Compulsivo Revisado — rastreio de sintomas de TOC, 18 itens sobre o quanto cada experiência incomodou no último mês.",
  instrucao:
    "As frases a seguir descrevem experiências comuns no dia a dia. Para cada uma, indique o quanto ela lhe causou aflição ou incômodo durante o último mês.",
  opcoes: OPCOES_OCIR,
  itens: [
    { id: "q1", texto: "Guardei tantas coisas que elas acabam atrapalhando." },
    { id: "q2", texto: "Verifico as coisas com mais frequência do que o necessário." },
    { id: "q3", texto: "Fico aborrecida(o) se os objetos não estão bem arrumados." },
    { id: "q4", texto: "Sinto-me compelida(o) a contar enquanto faço as coisas." },
    {
      id: "q5",
      texto:
        "Acho difícil tocar em um objeto quando sei que ele foi tocado por estranhos ou por certas pessoas.",
    },
    { id: "q6", texto: "Acho difícil controlar os meus próprios pensamentos." },
    { id: "q7", texto: "Junto coisas de que não preciso." },
    { id: "q8", texto: "Verifico repetidamente portas, janelas, gavetas e coisas assim." },
    {
      id: "q9",
      texto: "Fico aborrecida(o) se outras pessoas mudam a maneira como arrumei as coisas.",
    },
    { id: "q10", texto: "Sinto que tenho de repetir certos números." },
    {
      id: "q11",
      texto: "Às vezes preciso me lavar ou me limpar só porque me sinto contaminada(o).",
    },
    {
      id: "q12",
      texto:
        "Fico aborrecida(o) com pensamentos desagradáveis que surgem na minha mente contra a minha vontade.",
    },
    {
      id: "q13",
      texto: "Evito jogar coisas fora porque tenho medo de precisar delas mais tarde.",
    },
    {
      id: "q14",
      texto:
        "Verifico repetidamente as torneiras de gás e de água e os interruptores de luz depois de desligá-los.",
    },
    { id: "q15", texto: "Preciso que as coisas estejam organizadas numa ordem específica." },
    { id: "q16", texto: "Sinto que existem números bons e números ruins." },
    { id: "q17", texto: "Lavo as mãos com mais frequência e por mais tempo do que o necessário." },
    {
      id: "q18",
      texto: "Fico frequentemente com pensamentos ruins e tenho dificuldade de me livrar deles.",
    },
  ],
  faixas: [
    { min: 0, max: 20, label: "Abaixo do ponto de corte" },
    { min: 21, max: 72, label: "Acima do ponto de corte — sugere TOC provável" },
  ],
  corte: {
    valor: 21,
    rotulo:
      "21+ sugere TOC provável (corte de Foa et al., 2002, mantido na adaptação brasileira de Souza et al., 2008) — encaminhar para avaliação diagnóstica",
  },
};

// Y-BOCS — Yale-Brown Obsessive Compulsive Scale, escala de gravidade de
// Goodman, Price, Rasmussen et al. (1989), Arch Gen Psychiatry 46:1006-1011.
// A versão oficial é uma ENTREVISTA aplicada pelo clínico; aqui está a
// adaptação de AUTORRELATO (Y-BOCS Self-Report — linha de Baer, 1991, e
// Steketee, Frost & Bogart, 1996), que reaproveita os 10 itens de gravidade
// e os mesmos textos-âncora, respondidos pela própria pessoa. Só a parte de
// gravidade — a lista de sintomas (symptom checklist) não entra.
//
// RESSALVA: os 10 itens e as âncoras 0-4 abaixo foram redigidos a partir da
// versão amplamente reproduzida do instrumento — não copiados de um
// documento oficial em português conferido aqui. Com a versão brasileira
// validada em mãos (ex.: PROTOC/UFRGS, ou Asbahr et al.), vale substituir
// pela redação exata dela.
//
// Itens 1-5 = obsessões, 6-10 = compulsões; cada um 0-4; total 0-40. As
// faixas (subclínico/leve/moderado/grave/extremo) são as de uso consagrado
// sobre o TOTAL. Como na EPDS, cada item traz âncoras próprias de resposta
// (item.opcoes), então escala.opcoes fica vazio. Diferente das escalas de
// rastreio daqui, a Y-BOCS mede intensidade em quem já tem o diagnóstico —
// o rótulo do corte deixa isso explícito.
export const YBOCS: EscalaLikert = {
  tipo: "likert",
  slug: "ybocs",
  nome: "Y-BOCS (gravidade do TOC)",
  descricaoCurta:
    "Escala Yale-Brown de gravidade do TOC, versão de autorrelato — 10 itens sobre a intensidade de obsessões e compulsões na última semana.",
  instrucao:
    "As perguntas são sobre pensamentos obsessivos (ideias, imagens ou impulsos indesejados que voltam à mente) e comportamentos compulsivos (atos que a pessoa sente que precisa repetir). Responda pensando nos últimos 7 dias. As 5 primeiras perguntas se referem às obsessões; as 5 últimas, às compulsões.",
  opcoes: [],
  itens: [
    {
      id: "q1",
      texto: "Tempo ocupado por pensamentos obsessivos — quanto do seu tempo eles ocupam?",
      opcoes: [
        { valor: 0, label: "Nenhum", descricao: "Nenhum tempo ocupado por pensamentos obsessivos" },
        { valor: 1, label: "Leve", descricao: "Menos de 1 hora por dia, ou pensamentos ocasionais" },
        { valor: 2, label: "Moderado", descricao: "De 1 a 3 horas por dia, ou pensamentos frequentes" },
        {
          valor: 3,
          label: "Grave",
          descricao: "Mais de 3 e até 8 horas por dia, ou pensamentos muito frequentes",
        },
        { valor: 4, label: "Extremo", descricao: "Mais de 8 horas por dia, ou pensamentos quase constantes" },
      ],
    },
    {
      id: "q2",
      texto: "Interferência dos pensamentos obsessivos na vida social e no trabalho ou nos estudos",
      opcoes: [
        { valor: 0, label: "Nenhuma", descricao: "Nenhuma interferência" },
        {
          valor: 1,
          label: "Leve",
          descricao: "Interferência leve, sem prejudicar o desempenho geral",
        },
        {
          valor: 2,
          label: "Moderada",
          descricao: "Interferência clara no desempenho, mas ainda administrável",
        },
        { valor: 3, label: "Grave", descricao: "Prejuízo importante no desempenho social ou nas tarefas" },
        { valor: 4, label: "Extrema", descricao: "Interferência incapacitante" },
      ],
    },
    {
      id: "q3",
      texto: "Sofrimento causado pelos pensamentos obsessivos",
      opcoes: [
        { valor: 0, label: "Nenhum", descricao: "Nenhum sofrimento" },
        { valor: 1, label: "Leve", descricao: "Sofrimento pouco frequente e pouco perturbador" },
        {
          valor: 2,
          label: "Moderado",
          descricao: "Sofrimento frequente e perturbador, mas ainda administrável",
        },
        { valor: 3, label: "Grave", descricao: "Sofrimento muito frequente e muito perturbador" },
        { valor: 4, label: "Extremo", descricao: "Sofrimento quase constante e incapacitante" },
      ],
    },
    {
      id: "q4",
      texto: "Resistência às obsessões — quanto esforço você faz para resistir a elas?",
      opcoes: [
        {
          valor: 0,
          label: "Resisto sempre",
          descricao: "Faço esforço para resistir o tempo todo, ou os sintomas são mínimos e não exigem resistência",
        },
        { valor: 1, label: "Resisto na maior parte do tempo", descricao: "Tento resistir à maioria das obsessões" },
        { valor: 2, label: "Faço algum esforço para resistir", descricao: "Resisto a algumas obsessões" },
        {
          valor: 3,
          label: "Cedo com relutância",
          descricao: "Cedo a quase todas as obsessões sem tentar controlá-las, mas com alguma relutância",
        },
        { valor: 4, label: "Cedo por completo", descricao: "Cedo total e voluntariamente a todas as obsessões" },
      ],
    },
    {
      id: "q5",
      texto: "Controle sobre os pensamentos obsessivos — consegue interrompê-los ou desviar deles?",
      opcoes: [
        { valor: 0, label: "Controle completo", descricao: "Consigo afastar as obsessões sempre que quero" },
        {
          valor: 1,
          label: "Muito controle",
          descricao: "Geralmente consigo interromper ou desviar as obsessões com algum esforço",
        },
        { valor: 2, label: "Controle moderado", descricao: "Às vezes consigo interromper ou desviar as obsessões" },
        {
          valor: 3,
          label: "Pouco controle",
          descricao: "Raramente consigo interromper as obsessões e tenho dificuldade de desviar a atenção delas",
        },
        {
          valor: 4,
          label: "Nenhum controle",
          descricao: "As obsessões são vividas como totalmente involuntárias; quase nunca consigo alterá-las",
        },
      ],
    },
    {
      id: "q6",
      texto: "Tempo gasto com comportamentos compulsivos — quanto tempo eles ocupam?",
      opcoes: [
        { valor: 0, label: "Nenhum", descricao: "Nenhum tempo gasto com comportamentos compulsivos" },
        { valor: 1, label: "Leve", descricao: "Menos de 1 hora por dia, ou realização ocasional" },
        { valor: 2, label: "Moderado", descricao: "De 1 a 3 horas por dia, ou realização frequente" },
        {
          valor: 3,
          label: "Grave",
          descricao: "Mais de 3 e até 8 horas por dia, ou realização muito frequente",
        },
        { valor: 4, label: "Extremo", descricao: "Mais de 8 horas por dia, ou realização quase constante" },
      ],
    },
    {
      id: "q7",
      texto: "Interferência dos comportamentos compulsivos na vida social e no trabalho ou nos estudos",
      opcoes: [
        { valor: 0, label: "Nenhuma", descricao: "Nenhuma interferência" },
        {
          valor: 1,
          label: "Leve",
          descricao: "Interferência leve, sem prejudicar o desempenho geral",
        },
        {
          valor: 2,
          label: "Moderada",
          descricao: "Interferência clara no desempenho, mas ainda administrável",
        },
        { valor: 3, label: "Grave", descricao: "Prejuízo importante no desempenho social ou nas tarefas" },
        { valor: 4, label: "Extrema", descricao: "Interferência incapacitante" },
      ],
    },
    {
      id: "q8",
      texto: "Ansiedade que surgiria se você fosse impedida(o) de realizar as compulsões",
      opcoes: [
        { valor: 0, label: "Nenhuma", descricao: "Nenhuma ansiedade se as compulsões forem impedidas" },
        { valor: 1, label: "Leve", descricao: "Apenas leve ansiedade se as compulsões forem impedidas" },
        {
          valor: 2,
          label: "Moderada",
          descricao: "A ansiedade aumenta, mas permanece administrável, se as compulsões forem impedidas",
        },
        {
          valor: 3,
          label: "Grave",
          descricao: "Aumento importante e muito perturbador da ansiedade se as compulsões forem interrompidas",
        },
        {
          valor: 4,
          label: "Extrema",
          descricao: "Ansiedade incapacitante diante de qualquer tentativa de reduzir as compulsões",
        },
      ],
    },
    {
      id: "q9",
      texto: "Resistência às compulsões — quanto esforço você faz para resistir a elas?",
      opcoes: [
        {
          valor: 0,
          label: "Resisto sempre",
          descricao: "Faço esforço para resistir o tempo todo, ou os sintomas são mínimos e não exigem resistência",
        },
        { valor: 1, label: "Resisto na maior parte do tempo", descricao: "Tento resistir à maioria das compulsões" },
        { valor: 2, label: "Faço algum esforço para resistir", descricao: "Resisto a algumas compulsões" },
        {
          valor: 3,
          label: "Cedo com relutância",
          descricao: "Cedo a quase todas as compulsões sem tentar controlá-las, mas com alguma relutância",
        },
        { valor: 4, label: "Cedo por completo", descricao: "Cedo total e voluntariamente a todas as compulsões" },
      ],
    },
    {
      id: "q10",
      texto: "Controle sobre o comportamento compulsivo — qual a força do impulso de realizá-lo?",
      opcoes: [
        {
          valor: 0,
          label: "Controle completo",
          descricao: "Consigo resistir totalmente ao impulso de realizar a compulsão",
        },
        {
          valor: 1,
          label: "Muito controle",
          descricao: "Sinto pressão para realizar a compulsão, mas geralmente consigo controlá-la",
        },
        {
          valor: 2,
          label: "Controle moderado",
          descricao: "Forte pressão para realizar a compulsão; só consigo controlá-la com dificuldade",
        },
        {
          valor: 3,
          label: "Pouco controle",
          descricao: "Pressão muito forte; preciso levar a compulsão até o fim e só consigo adiá-la com dificuldade",
        },
        {
          valor: 4,
          label: "Nenhum controle",
          descricao: "O impulso de realizar a compulsão é vivido como completamente involuntário e irresistível",
        },
      ],
    },
  ],
  faixas: [
    { min: 0, max: 7, label: "Subclínico" },
    { min: 8, max: 15, label: "Leve" },
    { min: 16, max: 23, label: "Moderado" },
    { min: 24, max: 31, label: "Grave" },
    { min: 32, max: 40, label: "Extremo" },
  ],
  corte: {
    valor: 16,
    rotulo:
      "16+ costuma marcar TOC clinicamente significativo — referência de gravidade, não corte diagnóstico (a Y-BOCS mede intensidade em quem já tem o diagnóstico)",
  },
};

// AQ-10 (versão Criança) — Allison, Auyeung & Baron-Cohen (2012), "Toward
// brief 'Red Flags' for autism screening", J Am Acad Child Adolesc
// Psychiatry 51(2):202-212, derivada do AQ-Child (Auyeung et al., 2008). É
// questionário de rastreio respondido por quem cuida de uma criança de 4 a
// 11 anos. O Autism Research Centre (Cambridge) libera o uso clínico sem
// custo, citando os autores.
//
// RESSALVA: os 10 itens abaixo foram redigidos a partir da versão canônica
// em inglês (folha de aplicação do ARC), não copiados de uma tradução
// validada para o português conferida item a item. Com a versão brasileira
// validada em mãos, vale substituir pela redação exata.
//
// Pontuação: a mesma escala de resposta de 4 pontos ("concordo plenamente"
// a "discordo plenamente") em todos os itens; cada item vale 1 ponto quando
// a resposta cai do lado que indica traço autista — "concordo" nos itens 1,
// 5, 7 e 10; "discordo" nos itens 2, 3, 4, 6, 8 e 9 (estes com reverso:
// true). A binarização por item roda em calcularLikert (limiarBinario: 2,
// aplicado depois do reverso); total 0-10. Corte >= 6, ponto recomendado
// por Allison et al. — a mesma folha às vezes é lida como "mais de 6"
// (>= 7); a ambiguidade fica registrada aqui e, na tela, o 6 é gatilho de
// encaminhamento, nunca de diagnóstico.
const OPCOES_AQ10: OpcaoLikert[] = [
  { valor: 3, label: "Concordo plenamente", descricao: "" },
  { valor: 2, label: "Concordo um pouco", descricao: "" },
  { valor: 1, label: "Discordo um pouco", descricao: "" },
  { valor: 0, label: "Discordo plenamente", descricao: "" },
];

export const AQ10: EscalaLikert = {
  tipo: "likert",
  slug: "aq10",
  nome: "AQ-10 Criança (traços do espectro autista)",
  descricaoCurta:
    "Autism-Spectrum Quotient, versão Criança — triagem breve de traços do espectro autista em crianças de 4 a 11 anos, respondida por quem cuida. 10 itens. Rastreio, não diagnóstico.",
  instrucao:
    "Pensando em como a criança costuma ser no dia a dia, escolha o quanto você concorda com cada afirmação. Responda quem convive de perto com ela (pai, mãe ou cuidador). Não há resposta certa ou errada.",
  opcoes: OPCOES_AQ10,
  limiarBinario: 2,
  itens: [
    {
      id: "q1",
      texto: "A criança costuma perceber pequenos sons que outras pessoas não notam.",
    },
    {
      id: "q2",
      texto:
        "A criança geralmente presta mais atenção ao conjunto das coisas do que aos pequenos detalhes.",
      reverso: true,
    },
    {
      id: "q3",
      texto:
        "Num grupo, a criança consegue acompanhar com facilidade várias conversas ao mesmo tempo.",
      reverso: true,
    },
    {
      id: "q4",
      texto: "A criança troca de uma atividade para outra com facilidade.",
      reverso: true,
    },
    {
      id: "q5",
      texto: "A criança não sabe como manter uma conversa com crianças da mesma idade.",
    },
    {
      id: "q6",
      texto: "A criança se sai bem em conversas informais e descontraídas.",
      reverso: true,
    },
    {
      id: "q7",
      texto:
        "Quando alguém lê uma história para a criança, ela tem dificuldade de entender as intenções ou os sentimentos dos personagens.",
    },
    {
      id: "q8",
      texto:
        "Na época da educação infantil, a criança gostava de brincar de faz de conta com outras crianças.",
      reverso: true,
    },
    {
      id: "q9",
      texto:
        "A criança percebe com facilidade o que outra pessoa está pensando ou sentindo só de olhar para o rosto dela.",
      reverso: true,
    },
    {
      id: "q10",
      texto: "A criança tem dificuldade para fazer novos amigos.",
    },
  ],
  faixas: [
    { min: 0, max: 5, label: "Rastreio negativo" },
    { min: 6, max: 10, label: "Rastreio positivo — considerar encaminhamento" },
  ],
  corte: {
    valor: 6,
    rotulo:
      "6+ sugere encaminhar a criança para avaliação diagnóstica especializada — rastreio, não diagnóstico",
  },
};

// EAR — Escala de Autoestima de Rosenberg (Rosenberg Self-Esteem Scale,
// Rosenberg, 1965, "Society and the Adolescent Self-Image"). Instrumento de
// domínio público, um dos mais usados e estudados em todo o mundo. Adaptação
// brasileira: Hutz & Zanon (2011), "Revisão da adaptação, validação e
// normatização da escala de autoestima de Rosenberg", Avaliação Psicológica
// 10(1):41-49 — mesma tradução amplamente reproduzida em pesquisa e prática
// clínica no Brasil.
//
// RESSALVA: os 10 itens abaixo foram redigidos a partir dessa tradução tal
// como ela circula de forma consistente entre fontes acadêmicas brasileiras
// — não copiados diretamente do artigo de Hutz & Zanon aqui no momento desta
// implementação. Com o artigo original em mãos, vale conferir item a item.
//
// Pontuação: 5 itens de redação positiva (1, 3, 4, 7, 10) somam a resposta
// bruta; os outros 5 (2, 5, 6, 8, 9), de redação negativa, são invertidos
// (reverso: true) — mesmo mecanismo do GDS-15/PSS-10. Escala de concordância
// de 4 pontos, valores 0-3 por item, total 0-30: quanto maior, maior a
// autoestima (ao contrário das escalas de sintoma deste arquivo).
//
// Assim como a PSS-10, a EAR não tem um ponto de corte diagnóstico oficial
// — é um traço dimensional, não uma condição clínica a rastrear. A faixa
// abaixo (< 15 sugerindo autoestima baixa) é a referência informal mais
// citada sobre a pontuação 0-30 original de Rosenberg, não um corte validado
// com sensibilidade/especificidade — o rótulo deixa isso explícito.
const OPCOES_EAR: OpcaoLikert[] = [
  { valor: 0, label: "Discordo totalmente", descricao: "" },
  { valor: 1, label: "Discordo", descricao: "" },
  { valor: 2, label: "Concordo", descricao: "" },
  { valor: 3, label: "Concordo totalmente", descricao: "" },
];

export const EAR: EscalaLikert = {
  tipo: "likert",
  slug: "ear",
  nome: "EAR (autoestima)",
  descricaoCurta:
    "Escala de Autoestima de Rosenberg — mede o nível geral de autoestima, 10 afirmações sobre como a pessoa se vê.",
  instrucao: "Leia cada afirmação e indique o quanto você concorda com ela, pensando em como você se sente em geral.",
  opcoes: OPCOES_EAR,
  itens: [
    { id: "q1", texto: "Em geral, estou satisfeito(a) comigo mesmo(a)." },
    { id: "q2", texto: "Às vezes, penso que não sou bom(boa) em nada.", reverso: true },
    { id: "q3", texto: "Eu sinto que tenho boas qualidades." },
    { id: "q4", texto: "Eu sou capaz de fazer as coisas tão bem quanto a maioria das pessoas." },
    { id: "q5", texto: "Eu sinto que não tenho muito do que me orgulhar.", reverso: true },
    { id: "q6", texto: "Eu, certamente, me sinto inútil às vezes.", reverso: true },
    {
      id: "q7",
      texto: "Eu sinto que sou uma pessoa de valor, pelo menos tanto quanto as outras pessoas.",
    },
    { id: "q8", texto: "Eu gostaria de ter mais respeito por mim mesmo(a).", reverso: true },
    {
      id: "q9",
      texto: "Levando tudo em consideração, eu tendo a achar que sou um(a) fracassado(a).",
      reverso: true,
    },
    { id: "q10", texto: "Eu tenho uma atitude positiva em relação a mim mesmo(a)." },
  ],
  faixas: [
    { min: 0, max: 14, label: "Autoestima baixa" },
    { min: 15, max: 25, label: "Autoestima dentro da média" },
    { min: 26, max: 30, label: "Autoestima elevada" },
  ],
  corte: {
    valor: 15,
    rotulo:
      "Referência informal, não corte diagnóstico — a EAR não avalia uma condição clínica, mede um traço contínuo (quanto maior, maior a autoestima); abaixo de 15 é o ponto mais citado como indicativo de autoestima baixa",
  },
};

// ECAP — Escala de Compulsão Alimentar Periódica (Binge Eating Scale,
// Gormally, Black, Daston & Rardin, 1982, Addict Behav 7:47-55). Texto,
// instruções e grade de correção transcritos do Anexo de Freitas, Lopes,
// Coutinho & Appolinario (2001), "Tradução e adaptação para o português da
// Escala de Compulsão Alimentar Periódica", Rev Bras Psiquiatr 23(4):215-20.
//
// Únicas mudanças em relação ao texto do Anexo: ortografia atualizada pelo
// Acordo de 2009 ("freqüentemente" -> "frequentemente", "idéia" -> "ideia")
// e "mastigá-la" reconstituído da hifenização de fim de linha do PDF.
//
// O instrumento não tem enunciado por item, só grupos de afirmações: o
// "texto" de cada item repete a instrução, sem acrescentar conteúdo. Os
// pontos NÃO são 0-1-2-3 lineares — cada afirmação tem o peso da grade de
// correção (ex.: item 1 vale 0/0/1/3; item 4 vale 0/0/0/2), por isso cada
// item traz as próprias opções, como na EPDS. Itens 6 e 16 têm só 3
// afirmações. Total 0-46.
//
// Faixas de Marcus et al. (1985), citadas no artigo: <= 17 sem CAP, 18-26
// CAP moderada, >= 27 CAP grave. O artigo ressalta que a ECAP rastreia, mas
// não se correlaciona aos critérios diagnósticos do TCAP — o diagnóstico
// precisa de entrevista clínica.
//
// Item 11, afirmação 4, menciona vômito/laxativos/diuréticos (comportamento
// compensatório), mas não é ideação de autolesão — por isso a ECAP não usa
// itemAlertaRisco, que neste arquivo é reservado a risco de suicídio/autolesão.
const TEXTO_ITEM_ECAP = "Marque a afirmação que melhor descreve você.";

function opcoesEcap(pontos: number[], frases: string[]): OpcaoLikert[] {
  return frases.map((label, i) => ({ valor: pontos[i], label, descricao: "" }));
}

export const ECAP: EscalaLikert = {
  tipo: "likert",
  slug: "ecap",
  nome: "ECAP (compulsão alimentar periódica)",
  descricaoCurta:
    "Escala de Compulsão Alimentar Periódica — avalia a gravidade da compulsão alimentar, 16 grupos de afirmações. Rastreio, não diagnóstico.",
  instrucao:
    "Você encontrará abaixo grupos de afirmações numeradas. Leia todas as afirmações em cada grupo e marque aquela que melhor descreve o modo como você se sente em relação aos problemas que tem para controlar seu comportamento alimentar.",
  // Nunca usada de fato (todo item tem opcoes próprio) — só preenche o tipo.
  opcoes: [],
  itens: [
    {
      id: "q1",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 0, 1, 3],
        [
          "Eu não me sinto constrangido(a) com o meu peso ou o tamanho do meu corpo quando estou com outras pessoas.",
          "Eu me sinto preocupado(a) em como pareço para os outros, mas isto, normalmente, não me faz sentir desapontado(a) comigo mesmo(a).",
          "Eu fico mesmo constrangido(a) com a minha aparência e o meu peso, o que me faz sentir desapontado(a) comigo mesmo(a).",
          "Eu me sinto muito constrangido(a) com o meu peso e, frequentemente, sinto muita vergonha e desprezo por mim mesmo(a). Tento evitar contatos sociais por causa desse constrangimento.",
        ]
      ),
    },
    {
      id: "q2",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Eu não tenho nenhuma dificuldade para comer devagar, de maneira apropriada.",
          "Embora pareça que eu devore os alimentos, não acabo me sentindo empanturrado(a) por comer demais.",
          "Às vezes tendo a comer rapidamente, sentindo-me então desconfortavelmente cheio(a) depois.",
          "Eu tenho o hábito de engolir minha comida sem realmente mastigá-la. Quando isto acontece, em geral me sinto desconfortavelmente empanturrado(a) por ter comido demais.",
        ]
      ),
    },
    {
      id: "q3",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 3, 3],
        [
          "Eu me sinto capaz de controlar meus impulsos para comer, quando eu quero.",
          "Eu sinto que tenho falhado em controlar meu comportamento alimentar mais do que a média das pessoas.",
          "Eu me sinto totalmente incapaz de controlar meus impulsos para comer.",
          "Por me sentir tão incapaz de controlar meu comportamento alimentar, entro em desespero tentando manter o controle.",
        ]
      ),
    },
    {
      id: "q4",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 0, 0, 2],
        [
          "Eu não tenho o hábito de comer quando estou chateado(a).",
          "Às vezes eu como quando estou chateado(a) mas, frequentemente, sou capaz de me ocupar e afastar minha mente da comida.",
          "Eu tenho o hábito regular de comer quando estou chateado(a) mas, de vez em quando, posso usar alguma outra atividade para afastar minha mente da comida.",
          "Eu tenho o forte hábito de comer quando estou chateado(a). Nada parece me ajudar a parar com esse hábito.",
        ]
      ),
    },
    {
      id: "q5",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Normalmente quando como alguma coisa é porque estou fisicamente com fome.",
          "De vez em quando como alguma coisa por impulso, mesmo quando não estou realmente com fome.",
          "Eu tenho o hábito regular de comer alimentos que realmente não aprecio para satisfazer uma sensação de fome, mesmo que fisicamente eu não necessite de comida.",
          "Mesmo que não esteja fisicamente com fome, tenho uma sensação de fome em minha boca que somente parece ser satisfeita quando eu como um alimento, tipo um sanduíche, que enche a minha boca. Às vezes, quando eu como o alimento para satisfazer minha “fome na boca”, em seguida eu o cuspo, assim não ganharei peso.",
        ]
      ),
    },
    {
      id: "q6",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 3],
        [
          "Eu não sinto qualquer culpa ou ódio de mim mesmo(a) depois de comer demais.",
          "De vez em quando sinto culpa ou ódio de mim mesmo(a) depois de comer demais.",
          "Quase o tempo todo sinto muita culpa ou ódio de mim mesmo(a) depois de comer demais.",
        ]
      ),
    },
    {
      id: "q7",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 2, 3, 3],
        [
          "Eu não perco o controle total da minha alimentação quando estou em dieta, mesmo após períodos em que como demais.",
          "Às vezes, quando estou em dieta e como um alimento proibido, sinto como se tivesse estragado tudo e como ainda mais.",
          "Frequentemente, quando como demais durante uma dieta, tenho o hábito de dizer para mim mesmo(a): “agora que estraguei tudo, porque não irei até o fim”. Quando isto acontece, eu como ainda mais.",
          "Eu tenho o hábito regular de começar dietas rigorosas por mim mesmo(a), mas quebro as dietas entrando numa compulsão alimentar. Minha vida parece ser “uma festa” ou “um morrer de fome”.",
        ]
      ),
    },
    {
      id: "q8",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Eu raramente como tanta comida a ponto de me sentir desconfortavelmente empanturrado(a) depois.",
          "Normalmente, cerca de uma vez por mês, como uma tal quantidade de comida que acabo me sentindo muito empanturrado(a).",
          "Eu tenho períodos regulares durante o mês, quando como grandes quantidades de comida, seja na hora das refeições, seja nos lanches.",
          "Eu como tanta comida que, regularmente, me sinto bastante desconfortável depois de comer e, algumas vezes, um pouco enjoado(a).",
        ]
      ),
    },
    {
      id: "q9",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Em geral, minha ingesta calórica não sobe a níveis muito altos, nem desce a níveis muito baixos.",
          "Às vezes, depois de comer demais, tento reduzir minha ingesta calórica para quase nada, para compensar o excesso de calorias que ingeri.",
          "Eu tenho o hábito regular de comer demais durante a noite. Parece que a minha rotina não é estar com fome de manhã, mas comer demais à noite.",
          "Na minha vida adulta tenho tido períodos, que duram semanas, nos quais praticamente me mato de fome. Isto se segue a períodos em que como demais. Parece que vivo uma vida de “festa” ou de “morrer de fome”.",
        ]
      ),
    },
    {
      id: "q10",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Normalmente eu sou capaz de parar de comer quando quero. Eu sei quando “já chega”.",
          "De vez em quando, eu tenho uma compulsão para comer que parece que não posso controlar.",
          "Frequentemente tenho fortes impulsos para comer que parece que não sou capaz de controlar, mas, em outras ocasiões, posso controlar meus impulsos para comer.",
          "Eu me sinto incapaz de controlar impulsos para comer. Eu tenho medo de não ser capaz de parar de comer por vontade própria.",
        ]
      ),
    },
    {
      id: "q11",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Eu não tenho problema algum para parar de comer quando me sinto cheio(a).",
          "Eu, normalmente, posso parar de comer quando me sinto cheio(a) mas, de vez em quando, comer demais me deixa desconfortavelmente empanturrado(a).",
          "Eu tenho um problema para parar de comer uma vez que eu tenha começado e, normalmente, sinto-me desconfortavelmente empanturrado(a) depois que faço uma refeição.",
          "Por eu ter o problema de não ser capaz de parar de comer quando quero, às vezes tenho que provocar o vômito, usar laxativos e/ou diuréticos para aliviar minha sensação de empanturramento.",
        ]
      ),
    },
    {
      id: "q12",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Parece que eu como tanto quando estou com os outros (reuniões familiares, sociais), como quando estou sozinho(a).",
          "Às vezes, quando eu estou com outras pessoas, não como tanto quanto eu quero comer porque me sinto constrangido(a) com o meu comportamento alimentar.",
          "Frequentemente eu como só uma pequena quantidade de comida quando outros estão presentes, pois me sinto muito embaraçado(a) com o meu comportamento alimentar.",
          "Eu me sinto tão envergonhado(a) por comer demais que escolho horas para comer demais quando sei que ninguém me verá. Eu me sinto como uma pessoa que se esconde para comer.",
        ]
      ),
    },
    {
      id: "q13",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 0, 2, 3],
        [
          "Eu faço três refeições ao dia com apenas um lanche ocasional entre as refeições.",
          "Eu faço três refeições ao dia mas, normalmente, também lancho entre as refeições.",
          "Quando eu faço lanches pesados, tenho o hábito de pular as refeições regulares.",
          "Há períodos regulares em que parece que eu estou continuamente comendo, sem refeições planejadas.",
        ]
      ),
    },
    {
      id: "q14",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Eu não penso muito em tentar controlar impulsos indesejáveis para comer.",
          "Pelo menos, em algum momento, sinto que meus pensamentos estão “pré-ocupados” com tentar controlar meus impulsos para comer.",
          "Frequentemente, sinto que gasto muito tempo pensando no quanto comi ou tentando não comer mais.",
          "Parece, para mim, que a maior parte das horas que passo acordado(a) estão “pré-ocupadas” por pensamentos sobre comer ou não comer. Sinto como se eu estivesse constantemente lutando para não comer.",
        ]
      ),
    },
    {
      id: "q15",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2, 3],
        [
          "Eu não penso muito sobre comida.",
          "Eu tenho fortes desejos por comida, mas eles só duram curtos períodos de tempo.",
          "Há dias em que parece que eu não posso pensar em mais nada a não ser comida.",
          "Na maioria dos dias, meus pensamentos parecem estar “pré-ocupados” com comida. Sinto como se eu vivesse para comer.",
        ]
      ),
    },
    {
      id: "q16",
      texto: TEXTO_ITEM_ECAP,
      opcoes: opcoesEcap(
        [0, 1, 2],
        [
          "Eu normalmente sei se estou ou não fisicamente com fome. Eu como a porção certa de comida para me satisfazer.",
          "De vez em quando eu me sinto em dúvida para saber se estou ou não fisicamente com fome. Nessas ocasiões é difícil saber quanto eu deveria comer para me satisfazer.",
          "Mesmo que se eu pudesse saber quantas calorias eu deveria ingerir, não teria ideia alguma de qual seria a quantidade “normal” de comida para mim.",
        ]
      ),
    },
  ],
  faixas: [
    { min: 0, max: 17, label: "Sem compulsão alimentar periódica" },
    { min: 18, max: 26, label: "Compulsão alimentar periódica moderada" },
    { min: 27, max: 46, label: "Compulsão alimentar periódica grave" },
  ],
  corte: {
    valor: 18,
    rotulo:
      "18+ sugere compulsão alimentar periódica (Marcus et al., 1985) — rastreio; o diagnóstico de TCAP exige confirmação por entrevista clínica",
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
  OCIR,
  YBOCS,
  AQ10,
  EAR,
  ECAP,
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
  {
    categoria: "Neurodesenvolvimento",
    sigla: "AQ-10 (Adolescente/Adulto)",
    nome: "Autism-Spectrum Quotient — versões 12-15 e 16+ anos",
    motivo: `A versão Criança (4 a 11 anos) já está disponível para envio. As versões Adolescente e Adulto têm itens próprios. ${MOTIVO_FALTA_TEXTO_OFICIAL}`,
  },
  { categoria: "Neurodesenvolvimento", sigla: "CAT-Q", nome: "Camouflaging Autistic Traits Questionnaire", motivo: MOTIVO_REQUER_AUTORIZACAO },
  {
    categoria: "Neurodesenvolvimento",
    sigla: "CARS",
    nome: "Childhood Autism Rating Scale (15 itens)",
    motivo:
      "Aplicada e pontuada pelo profissional a partir de observação direta da criança — não é autorrelato, então não cabe no modelo de link deste catálogo. É também instrumento comercial protegido (Western Psychological Services): os 15 itens e as âncoras de pontuação não podem ser reproduzidos aqui. O escore obtido na aplicação entra à mão na evolução.",
  },
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
  const total = escala.itens.reduce((soma, item) => {
    const pontos = pontosDoItem(escala, item, respostas);
    // AQ-10: cada item vale 1 ou 0 conforme a resposta cair de um lado do
    // meio da escala (ver EscalaLikert.limiarBinario) — o total 0-10 é o que
    // tem ponto de corte publicado, não a soma bruta dos valores 0-3.
    if (escala.limiarBinario !== undefined) {
      return soma + (pontos >= escala.limiarBinario ? 1 : 0);
    }
    return soma + pontos;
  }, 0);

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
