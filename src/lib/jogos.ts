/**
 * Catálogo de atividades interativas ("jogos") do Espaço Interativo.
 *
 * Diferença importante para src/lib/escalas.ts: escala é instrumento de
 * triagem, com pontuação e faixa clínica. Estes jogos NÃO pontuam e NÃO
 * classificam ninguém — são exercícios de reflexão, regulação e vínculo,
 * para o paciente fazer sozinho entre as sessões. Por isso vivem em tabelas
 * separadas (convites_jogo / respostas_jogo): uma reflexão não pode ser
 * confundida com resultado de instrumento dentro do prontuário.
 *
 * Quem aplica é o psicólogo, como nas escalas — o paciente não escolhe
 * sozinho o que fazer. Nada aqui substitui atendimento.
 */

export type PublicoJogo = "criancas" | "adolescentes" | "adultos" | "casais";

export const PUBLICO_LABELS: Record<PublicoJogo, string> = {
  criancas: "Crianças",
  adolescentes: "Adolescentes",
  adultos: "Adultos",
  casais: "Casais e relações",
};

/** Mesma convenção de patient-activities.ts: chave, não classe montada. */
export type CorJogo = "roxo" | "azul" | "verde" | "laranja" | "rosa";

export type IconeJogo = "heart" | "brain" | "smile" | "star" | "wind" | "users";

export type PassoJogo =
  | {
      tipo: "respiracao";
      id: string;
      titulo: string;
      instrucao: string;
      ciclos: number;
      /** Segundos de cada fase. Segurar 0 = pula a fase. */
      inspirar: number;
      segurar: number;
      expirar: number;
    }
  | {
      tipo: "escolha";
      id: string;
      pergunta: string;
      ajuda?: string;
      opcoes: { valor: string; rotulo: string; emoji?: string }[];
    }
  | {
      tipo: "texto";
      id: string;
      pergunta: string;
      ajuda?: string;
      placeholder?: string;
      /** Resposta curta usa input; longa usa textarea. */
      longo?: boolean;
    }
  | {
      tipo: "escala";
      id: string;
      pergunta: string;
      ajuda?: string;
      itens: { chave: string; rotulo: string }[];
      rotuloMin: string;
      rotuloMax: string;
    }
  | {
      tipo: "selecao";
      id: string;
      pergunta: string;
      ajuda?: string;
      opcoes: string[];
      maxEscolhas: number;
    };

export type Jogo = {
  slug: string;
  nome: string;
  publico: PublicoJogo;
  temas: string[];
  descricao: string;
  duracao: string;
  cor: CorJogo;
  icone: IconeJogo;
  /** Mostrado antes de começar, no tom de quem vai jogar. */
  abertura: string;
  passos: PassoJogo[];
  /** Mostrado ao terminar. Nunca interpreta nem devolve resultado. */
  fechamento: string;
};

const EMOCOES = [
  { valor: "alegre", rotulo: "Alegre", emoji: "😀" },
  { valor: "triste", rotulo: "Triste", emoji: "😢" },
  { valor: "bravo", rotulo: "Com raiva", emoji: "😠" },
  { valor: "medo", rotulo: "Com medo", emoji: "😨" },
  { valor: "calmo", rotulo: "Calmo", emoji: "😌" },
  { valor: "confuso", rotulo: "Confuso", emoji: "😕" },
];

// =========================================================
// Crianças (6 a 12 anos)
// =========================================================

const BALAO_DA_RESPIRACAO: Jogo = {
  slug: "balao-da-respiracao",
  nome: "Respiração do Balão",
  publico: "criancas",
  temas: ["Relaxamento", "Ansiedade"],
  descricao:
    "Encha um balão imaginário devagarinho e solte o ar aos poucos. Serve pra hora que o corpo fica agitado demais.",
  duracao: "3 min",
  cor: "azul",
  icone: "wind",
  abertura:
    "Vamos encher um balão sem balão nenhum! É só seguir o desenho na tela com a sua respiração. Se quiser, coloque a mão na barriga pra sentir ela subindo.",
  passos: [
    {
      tipo: "respiracao",
      id: "balao",
      titulo: "Encha o balão",
      instrucao:
        "Puxe o ar pelo nariz enquanto o balão cresce, e solte pela boca enquanto ele murcha.",
      ciclos: 5,
      inspirar: 4,
      segurar: 2,
      expirar: 6,
    },
    {
      tipo: "escolha",
      id: "como-ficou",
      pergunta: "E aí, como seu corpo ficou depois?",
      opcoes: [
        { valor: "mais-calmo", rotulo: "Mais calminho", emoji: "😌" },
        { valor: "igual", rotulo: "Do mesmo jeito", emoji: "😐" },
        { valor: "agitado", rotulo: "Ainda agitado", emoji: "😣" },
      ],
    },
  ],
  fechamento:
    "Você pode fazer a respiração do balão quantas vezes quiser: antes de dormir, na hora da prova, ou quando a raiva aparecer.",
};

const TERMOMETRO_DAS_EMOCOES: Jogo = {
  slug: "termometro-das-emocoes",
  nome: "Termômetro das Emoções",
  publico: "criancas",
  temas: ["Emoções", "Autoconhecimento"],
  descricao:
    "Situações do dia a dia e as carinhas que combinam com elas. Ajuda a dar nome ao que a gente sente.",
  duracao: "5 min",
  cor: "laranja",
  icone: "smile",
  abertura:
    "Vou contar algumas situações. Escolha a carinha que mais parece com o que VOCÊ sentiria. Não tem resposta certa nem errada — cada pessoa sente de um jeito.",
  passos: [
    {
      tipo: "escolha",
      id: "sit-amigo",
      pergunta: "Seu melhor amigo faltou na escola hoje. Você fica...",
      opcoes: EMOCOES,
    },
    {
      tipo: "escolha",
      id: "sit-erro",
      pergunta: "Você errou uma questão que achou que tinha acertado. Você fica...",
      opcoes: EMOCOES,
    },
    {
      tipo: "escolha",
      id: "sit-mudanca",
      pergunta: "Alguém mexeu nas suas coisas sem pedir. Você fica...",
      opcoes: EMOCOES,
    },
    {
      tipo: "escolha",
      id: "sit-elogio",
      pergunta: "Alguém falou que gostou de uma coisa que você fez. Você fica...",
      opcoes: EMOCOES,
    },
    {
      tipo: "texto",
      id: "hoje",
      pergunta: "E hoje, qual carinha combina com o seu dia?",
      ajuda: "Pode escrever do seu jeito, com suas palavras.",
      longo: true,
      placeholder: "Hoje eu me senti...",
    },
  ],
  fechamento:
    "Saber o nome do que a gente sente já ajuda bastante. Se quiser, conte pro seu psicólogo o que você respondeu aqui.",
};

const BAU_DAS_FORCAS: Jogo = {
  slug: "bau-das-forcas",
  nome: "O Baú das Suas Forças",
  publico: "criancas",
  temas: ["Autoestima", "Autoconhecimento"],
  descricao:
    "Um baú cheio de qualidades pra você escolher as que combinam com você.",
  duracao: "4 min",
  cor: "roxo",
  icone: "star",
  abertura:
    "Todo mundo tem forças — coisas boas que a gente é ou faz. Escolha as que mais combinam com você. Pode escolher até 5.",
  passos: [
    {
      tipo: "selecao",
      id: "minhas-forcas",
      pergunta: "Quais dessas forças são suas?",
      ajuda: "Escolha até 5. Se ficar na dúvida, pense no que seus amigos diriam.",
      maxEscolhas: 5,
      opcoes: [
        "Sou engraçado(a)",
        "Ajudo quem precisa",
        "Sou curioso(a)",
        "Sou corajoso(a)",
        "Sei ouvir",
        "Sou criativo(a)",
        "Sou carinhoso(a)",
        "Não desisto fácil",
        "Sou organizado(a)",
        "Sou bom(boa) de conversa",
        "Sou paciente",
        "Sou honesto(a)",
      ],
    },
    {
      tipo: "texto",
      id: "exemplo",
      pergunta: "Conte uma vez em que você usou uma dessas forças.",
      ajuda: "Pode ser uma coisa pequena, do dia a dia.",
      longo: true,
      placeholder: "Uma vez eu...",
    },
    {
      tipo: "texto",
      id: "quero-ter",
      pergunta: "Tem alguma força que você gostaria de ter mais?",
      longo: false,
      placeholder: "Eu queria ser mais...",
    },
  ],
  fechamento:
    "Guarde essas forças no seu baú. Elas continuam suas mesmo nos dias ruins.",
};

const MONSTRO_DAS_PREOCUPACOES: Jogo = {
  slug: "monstro-das-preocupacoes",
  nome: "O Monstro das Preocupações",
  publico: "criancas",
  temas: ["Ansiedade", "Emoções"],
  descricao:
    "Dê nome e forma pra aquilo que te deixa preocupado — fica mais fácil de encarar.",
  duracao: "6 min",
  cor: "verde",
  icone: "heart",
  abertura:
    "Toda preocupação fica menor quando a gente olha bem pra ela. Vamos transformar a sua num monstrinho — assim dá pra conversar com ele.",
  passos: [
    {
      tipo: "texto",
      id: "preocupacao",
      pergunta: "Qual preocupação anda te visitando?",
      ajuda: "Aquela coisa que fica voltando na sua cabeça.",
      longo: true,
      placeholder: "Eu fico preocupado(a) com...",
    },
    {
      tipo: "texto",
      id: "nome-monstro",
      pergunta: "Se ela fosse um monstrinho, que nome teria?",
      longo: false,
      placeholder: "Ex.: Senhor Talvez, Dona Dúvida...",
    },
    {
      tipo: "escolha",
      id: "tamanho",
      pergunta: "Que tamanho ele tem hoje?",
      opcoes: [
        { valor: "pequeno", rotulo: "Pequenininho", emoji: "🐜" },
        { valor: "medio", rotulo: "Do meu tamanho", emoji: "🐕" },
        { valor: "gigante", rotulo: "Gigante", emoji: "🦕" },
      ],
    },
    {
      tipo: "escolha",
      id: "quando-vem",
      pergunta: "Quando ele costuma aparecer?",
      opcoes: [
        { valor: "escola", rotulo: "Na escola", emoji: "🏫" },
        { valor: "dormir", rotulo: "Na hora de dormir", emoji: "🌙" },
        { valor: "casa", rotulo: "Em casa", emoji: "🏠" },
        { valor: "sozinho", rotulo: "Quando fico sozinho(a)", emoji: "🚪" },
        { valor: "sempre", rotulo: "Em vários momentos", emoji: "🔁" },
      ],
    },
    {
      tipo: "texto",
      id: "o-que-ajuda",
      pergunta: "O que faz ele diminuir?",
      ajuda: "Pode ser uma pessoa, um lugar, uma brincadeira...",
      longo: true,
      placeholder: "Ele fica menor quando...",
    },
    {
      tipo: "texto",
      id: "quem-ajuda",
      pergunta: "Quem você chama quando ele fica grande demais?",
      longo: false,
      placeholder: "Ex.: minha mãe, meu irmão...",
    },
  ],
  fechamento:
    "Pronto: agora o monstrinho tem nome, tamanho e hora de aparecer. Mostre isso pro seu psicólogo na próxima sessão — vocês podem pensar juntos no que fazer com ele.",
};

// =========================================================
// Adolescentes
// =========================================================

const ESPELHO_SEM_FILTRO: Jogo = {
  slug: "espelho-sem-filtro",
  nome: "Espelho Sem Filtro",
  publico: "adolescentes",
  temas: ["Autoestima", "Autoconhecimento"],
  descricao:
    "Como você se enxerga hoje, sem plateia e sem precisar posar pra ninguém.",
  duracao: "6 min",
  cor: "roxo",
  icone: "star",
  abertura:
    "Aqui não tem like, não tem comentário e ninguém está olhando. É só você respondendo o que é verdade hoje — e hoje pode ser diferente de ontem.",
  passos: [
    {
      tipo: "escala",
      id: "como-me-vejo",
      pergunta: "De 0 a 10, como você está se sentindo em cada parte da sua vida?",
      ajuda: "Não pense muito, vá no primeiro número que vier.",
      rotuloMin: "Nada bem",
      rotuloMax: "Muito bem",
      itens: [
        { chave: "corpo", rotulo: "Meu corpo" },
        { chave: "amizades", rotulo: "Minhas amizades" },
        { chave: "escola", rotulo: "Escola / estudos" },
        { chave: "familia", rotulo: "Minha família" },
        { chave: "futuro", rotulo: "Meu futuro" },
        { chave: "eu", rotulo: "Eu comigo mesmo(a)" },
      ],
    },
    {
      tipo: "texto",
      id: "voz-critica",
      pergunta: "O que sua cabeça te fala quando você erra?",
      ajuda: "Escreva do jeito que a frase aparece, mesmo que seja dura.",
      longo: true,
      placeholder: "Minha cabeça fala...",
    },
    {
      tipo: "texto",
      id: "amigo",
      pergunta:
        "Se seu melhor amigo falasse isso sobre ele mesmo, o que você responderia?",
      longo: true,
      placeholder: "Eu diria pra ele que...",
    },
    {
      tipo: "texto",
      id: "orgulho",
      pergunta: "Cite uma coisa sua que ninguém percebe, mas você tem orgulho.",
      longo: true,
      placeholder: "Ninguém sabe, mas eu...",
    },
  ],
  fechamento:
    "Repare que você provavelmente foi mais gentil com seu amigo do que consigo. Isso não é fraqueza sua — é como quase todo mundo funciona. Vale conversar sobre isso na sessão.",
};

const MOCHILA_DA_PRESSAO: Jogo = {
  slug: "mochila-da-pressao",
  nome: "A Mochila da Pressão",
  publico: "adolescentes",
  temas: ["Ansiedade", "Relacionamentos"],
  descricao:
    "O que você carrega por escolha e o que colocaram nas suas costas sem perguntar.",
  duracao: "5 min",
  cor: "laranja",
  icone: "brain",
  abertura:
    "Todo mundo carrega cobranças: da família, dos amigos, da internet, de você mesmo. Vamos abrir a mochila e ver o que tem dentro.",
  passos: [
    {
      tipo: "selecao",
      id: "cobrancas",
      pergunta: "Quais dessas cobranças pesam em você hoje?",
      ajuda: "Escolha até 4.",
      maxEscolhas: 4,
      opcoes: [
        "Tirar notas altas",
        "Saber o que quero ser",
        "Ter o corpo 'certo'",
        "Estar sempre disponível no celular",
        "Não decepcionar meus pais",
        "Ser popular / ser aceito",
        "Estar sempre bem-humorado(a)",
        "Ter namoro / ficar com alguém",
        "Não demonstrar fraqueza",
      ],
    },
    {
      tipo: "escolha",
      id: "de-onde-vem",
      pergunta: "A cobrança mais pesada vem mais de onde?",
      opcoes: [
        { valor: "familia", rotulo: "Da minha família", emoji: "👪" },
        { valor: "amigos", rotulo: "Dos amigos / escola", emoji: "🎒" },
        { valor: "internet", rotulo: "Das redes sociais", emoji: "📱" },
        { valor: "eu", rotulo: "De mim mesmo(a)", emoji: "🪞" },
      ],
    },
    {
      tipo: "texto",
      id: "se-largasse",
      pergunta: "Se você pudesse tirar uma dessas da mochila hoje, qual seria?",
      longo: false,
      placeholder: "Eu tiraria...",
    },
    {
      tipo: "texto",
      id: "o-que-mudaria",
      pergunta: "O que mudaria no seu dia sem esse peso?",
      longo: true,
      placeholder: "Meu dia seria...",
    },
  ],
  fechamento:
    "Nem tudo que está na mochila foi você quem colocou. Levar isso pra sessão ajuda a decidir o que fica e o que pode sair.",
};

// =========================================================
// Adultos
// =========================================================

const PAUSA_DE_TRES_MINUTOS: Jogo = {
  slug: "pausa-de-tres-minutos",
  nome: "Pausa de Três Minutos",
  publico: "adultos",
  temas: ["Relaxamento", "Ansiedade"],
  descricao:
    "Uma respiração guiada para os dias em que tudo aperta ao mesmo tempo.",
  duracao: "3 min",
  cor: "azul",
  icone: "wind",
  abertura:
    "Três minutos, só isso. Sente-se de um jeito confortável, apoie os pés no chão e acompanhe o círculo na tela. Se a cabeça viajar, tudo bem — é só voltar.",
  passos: [
    {
      tipo: "respiracao",
      id: "respiracao",
      titulo: "Respire junto",
      instrucao:
        "Inspire pelo nariz, segure sem forçar e solte devagar pela boca.",
      ciclos: 6,
      inspirar: 4,
      segurar: 4,
      expirar: 6,
    },
    {
      tipo: "escala",
      id: "antes-depois",
      pergunta: "De 0 a 10, como está agora?",
      rotuloMin: "Muito tenso",
      rotuloMax: "Tranquilo",
      itens: [
        { chave: "corpo", rotulo: "Meu corpo" },
        { chave: "cabeca", rotulo: "Minha cabeça" },
      ],
    },
  ],
  fechamento:
    "Respirar não resolve o problema, mas devolve um pouco de espaço pra pensar nele. Pode repetir quantas vezes quiser.",
};

const ATERRISSAGEM: Jogo = {
  slug: "aterrissagem",
  nome: "Aterrissagem 5-4-3-2-1",
  publico: "adultos",
  temas: ["Ansiedade", "Relaxamento"],
  descricao:
    "Um exercício para trazer você de volta ao agora quando a ansiedade dispara.",
  duracao: "4 min",
  cor: "verde",
  icone: "brain",
  abertura:
    "Quando a ansiedade sobe, a cabeça vai pro futuro. Este exercício usa os cinco sentidos pra trazer você de volta pro lugar onde seu corpo está. Olhe em volta e responda com o que estiver aí agora.",
  passos: [
    {
      tipo: "texto",
      id: "ver",
      pergunta: "5 coisas que você está VENDO agora",
      ajuda: "Olhe em volta sem pressa. Vale o que for.",
      longo: true,
      placeholder: "Estou vendo...",
    },
    {
      tipo: "texto",
      id: "tocar",
      pergunta: "4 coisas que você pode TOCAR",
      ajuda: "Encoste de verdade em cada uma.",
      longo: true,
      placeholder: "Estou tocando...",
    },
    {
      tipo: "texto",
      id: "ouvir",
      pergunta: "3 sons que você está OUVINDO",
      longo: true,
      placeholder: "Estou ouvindo...",
    },
    {
      tipo: "texto",
      id: "cheirar",
      pergunta: "2 cheiros que você sente (ou gosta de sentir)",
      longo: false,
      placeholder: "Sinto cheiro de...",
    },
    {
      tipo: "texto",
      id: "gosto",
      pergunta: "1 gosto que você consegue perceber (ou lembrar)",
      longo: false,
      placeholder: "O gosto de...",
    },
    {
      tipo: "escolha",
      id: "agora",
      pergunta: "E agora?",
      opcoes: [
        { valor: "melhor", rotulo: "Um pouco melhor", emoji: "🌤️" },
        { valor: "igual", rotulo: "Mais ou menos igual", emoji: "☁️" },
        { valor: "pior", rotulo: "Ainda muito difícil", emoji: "🌧️" },
      ],
    },
  ],
  fechamento:
    "Se ainda estiver muito difícil, procure alguém de confiança agora. Em momentos de crise, o CVV atende de graça, 24 horas, pelo telefone 188.",
};

const RODA_DA_VIDA: Jogo = {
  slug: "roda-da-vida",
  nome: "Roda da Vida",
  publico: "adultos",
  temas: ["Autoconhecimento", "Bem-estar"],
  descricao:
    "Uma foto de como estão as áreas da sua vida hoje — e qual delas está pedindo atenção.",
  duracao: "6 min",
  cor: "roxo",
  icone: "star",
  abertura:
    "Dê uma nota de 0 a 10 para cada área, pensando em como ela está HOJE — não em como deveria estar. Ninguém tem 10 em tudo, e não é esse o objetivo.",
  passos: [
    {
      tipo: "escala",
      id: "areas",
      pergunta: "Como está cada área da sua vida hoje?",
      rotuloMin: "Muito insatisfeito",
      rotuloMax: "Muito satisfeito",
      itens: [
        { chave: "saude", rotulo: "Saúde e corpo" },
        { chave: "trabalho", rotulo: "Trabalho / estudos" },
        { chave: "dinheiro", rotulo: "Dinheiro" },
        { chave: "familia", rotulo: "Família" },
        { chave: "amor", rotulo: "Vida amorosa" },
        { chave: "amigos", rotulo: "Amizades" },
        { chave: "lazer", rotulo: "Lazer e descanso" },
        { chave: "proposito", rotulo: "Sentido / propósito" },
      ],
    },
    {
      tipo: "texto",
      id: "mais-baixa",
      pergunta: "Qual área você quer olhar com mais carinho agora?",
      longo: false,
      placeholder: "Ex.: descanso",
    },
    {
      tipo: "texto",
      id: "primeiro-passo",
      pergunta: "Qual seria um passo pequeno e possível nessa área esta semana?",
      ajuda: "Pequeno mesmo. Algo que caiba na sua semana real, não na ideal.",
      longo: true,
      placeholder: "Esta semana eu poderia...",
    },
  ],
  fechamento:
    "Guarde essa foto. Refazer a roda daqui a alguns meses costuma mostrar movimentos que passam despercebidos no dia a dia.",
};

const CADERNO_DAS_COISAS_BOAS: Jogo = {
  slug: "caderno-das-coisas-boas",
  nome: "Caderno das Coisas Boas",
  publico: "adultos",
  temas: ["Bem-estar", "Autocuidado"],
  descricao:
    "Três coisas boas do seu dia — inclusive nos dias em que parece não ter nenhuma.",
  duracao: "4 min",
  cor: "rosa",
  icone: "heart",
  abertura:
    "A cabeça guarda o que deu errado com muito mais facilidade do que o que deu certo. Este exercício é um contrapeso — não pra fingir que o dia foi bom, mas pra não perder o que teve de bom nele.",
  passos: [
    {
      tipo: "texto",
      id: "boa-1",
      pergunta: "Primeira coisa boa de hoje",
      ajuda: "Pode ser minúscula: um café, um silêncio, uma mensagem.",
      longo: true,
      placeholder: "Hoje foi bom quando...",
    },
    {
      tipo: "texto",
      id: "boa-2",
      pergunta: "Segunda coisa boa",
      longo: true,
      placeholder: "Também foi bom...",
    },
    {
      tipo: "texto",
      id: "boa-3",
      pergunta: "Terceira coisa boa",
      longo: true,
      placeholder: "E ainda...",
    },
    {
      tipo: "texto",
      id: "meu-papel",
      pergunta: "Você teve alguma participação em alguma delas?",
      ajuda: "Vale ter escolhido, ter aceitado, ter parado pra reparar.",
      longo: true,
      placeholder: "Eu ajudei quando...",
    },
  ],
  fechamento:
    "Se hoje foi difícil e você conseguiu escrever mesmo assim, isso já diz algo sobre você.",
};

const DETETIVE_DO_PENSAMENTO: Jogo = {
  slug: "detetive-do-pensamento",
  nome: "Detetive do Pensamento",
  publico: "adultos",
  temas: ["Autorreflexão", "Ansiedade"],
  descricao:
    "Investigue um pensamento que te derrubou: o que aconteceu, o que você pensou e o que mais poderia ser verdade.",
  duracao: "8 min",
  cor: "azul",
  icone: "brain",
  abertura:
    "Pensamento não é fato — é uma leitura da situação, e leitura pode ser revista. Escolha um momento recente que te derrubou e vamos investigá-lo com calma.",
  passos: [
    {
      tipo: "texto",
      id: "situacao",
      pergunta: "O que aconteceu?",
      ajuda: "Só os fatos, como uma câmera registraria. Sem interpretação ainda.",
      longo: true,
      placeholder: "Ontem, quando...",
    },
    {
      tipo: "texto",
      id: "pensamento",
      pergunta: "O que passou pela sua cabeça na hora?",
      ajuda: "A frase exata, mesmo que pareça exagerada.",
      longo: true,
      placeholder: "Eu pensei...",
    },
    {
      tipo: "escolha",
      id: "emocao",
      pergunta: "O que você sentiu?",
      opcoes: [
        { valor: "medo", rotulo: "Medo / ansiedade", emoji: "😰" },
        { valor: "tristeza", rotulo: "Tristeza", emoji: "😔" },
        { valor: "raiva", rotulo: "Raiva", emoji: "😤" },
        { valor: "vergonha", rotulo: "Vergonha", emoji: "😳" },
        { valor: "culpa", rotulo: "Culpa", emoji: "😞" },
      ],
    },
    {
      tipo: "texto",
      id: "a-favor",
      pergunta: "Que evidências apoiam esse pensamento?",
      ajuda: "Fatos concretos, não sensações.",
      longo: true,
      placeholder: "A favor:",
    },
    {
      tipo: "texto",
      id: "contra",
      pergunta: "E que evidências vão contra ele?",
      ajuda: "Vale lembrar de vezes em que aconteceu diferente.",
      longo: true,
      placeholder: "Contra:",
    },
    {
      tipo: "texto",
      id: "amigo",
      pergunta:
        "O que você diria a alguém que ama, se essa pessoa tivesse esse pensamento?",
      longo: true,
      placeholder: "Eu diria...",
    },
    {
      tipo: "texto",
      id: "reescrita",
      pergunta: "Como ficaria uma versão mais justa desse pensamento?",
      ajuda: "Não precisa ser positiva — precisa ser justa.",
      longo: true,
      placeholder: "Uma versão mais justa seria...",
    },
  ],
  fechamento:
    "Reescrever um pensamento não apaga o que você sentiu, e não é pra apagar mesmo. É um treino: quanto mais você investiga, menos automático ele fica. Vale levar essa investigação pra sessão.",
};

// =========================================================
// Casais e relações
// =========================================================

const MAPA_DAS_RELACOES: Jogo = {
  slug: "mapa-das-relacoes",
  nome: "Mapa das Suas Relações",
  publico: "casais",
  temas: ["Relacionamentos", "Autoconhecimento"],
  descricao:
    "Quem te acolhe, quem te cansa e quem você procura num dia difícil.",
  duracao: "7 min",
  cor: "verde",
  icone: "users",
  abertura:
    "Ninguém se sustenta sozinho. Vamos desenhar sua rede como ela é hoje — sem julgar se deveria ser diferente.",
  passos: [
    {
      tipo: "texto",
      id: "porto-seguro",
      pergunta: "Quem é a primeira pessoa que você procura num dia ruim?",
      longo: false,
      placeholder: "Ex.: minha irmã",
    },
    {
      tipo: "escala",
      id: "areas-rede",
      pergunta: "De 0 a 10, o quanto você sente que pode contar com cada grupo?",
      rotuloMin: "Não posso contar",
      rotuloMax: "Posso contar sempre",
      itens: [
        { chave: "parceiro", rotulo: "Parceiro(a)" },
        { chave: "familia", rotulo: "Família" },
        { chave: "amigos", rotulo: "Amigos" },
        { chave: "trabalho", rotulo: "Colegas de trabalho" },
        { chave: "comunidade", rotulo: "Vizinhança / comunidade" },
      ],
    },
    {
      tipo: "texto",
      id: "cansa",
      pergunta: "Que tipo de convivência te esgota hoje?",
      ajuda: "Descreva a situação, não precisa citar nomes.",
      longo: true,
      placeholder: "Me esgota quando...",
    },
    {
      tipo: "texto",
      id: "acolhe",
      pergunta: "E o que te faz sentir acolhido(a) de verdade?",
      longo: true,
      placeholder: "Me sinto acolhido(a) quando...",
    },
    {
      tipo: "texto",
      id: "aproximar",
      pergunta: "De quem você gostaria de estar mais perto?",
      longo: false,
      placeholder: "Eu gostaria de...",
    },
  ],
  fechamento:
    "Redes mudam com o tempo, e perceber isso é o primeiro passo pra cuidar delas. Leve esse mapa pra sessão.",
};

const COMO_EU_FALO_QUANDO_DOI: Jogo = {
  slug: "como-eu-falo-quando-doi",
  nome: "Como Eu Falo Quando Dói",
  publico: "casais",
  temas: ["Relacionamentos", "Comunicação"],
  descricao:
    "Situações de conflito e o que você costuma fazer nelas — sem julgamento, só pra enxergar seu padrão.",
  duracao: "6 min",
  cor: "rosa",
  icone: "users",
  abertura:
    "Nas horas de conflito, quase todo mundo repete um jeito aprendido lá atrás. Responda o que você REALMENTE costuma fazer, não o que gostaria de fazer — é isso que ajuda.",
  passos: [
    {
      tipo: "escolha",
      id: "quando-magoa",
      pergunta: "Quando alguém te magoa, você geralmente...",
      opcoes: [
        { valor: "cala", rotulo: "Fico calado(a) e guardo", emoji: "🤐" },
        { valor: "explode", rotulo: "Falo na hora, mesmo exaltado(a)", emoji: "🔥" },
        { valor: "ironia", rotulo: "Uso ironia ou indireta", emoji: "🙃" },
        { valor: "afasta", rotulo: "Me afasto por uns dias", emoji: "🚶" },
        { valor: "conversa", rotulo: "Peço pra conversar depois", emoji: "💬" },
      ],
    },
    {
      tipo: "escolha",
      id: "quando-erram-comigo",
      pergunta: "Quando você percebe que errou com alguém, você...",
      opcoes: [
        { valor: "pede", rotulo: "Peço desculpas logo", emoji: "🙏" },
        { valor: "justifica", rotulo: "Explico meus motivos primeiro", emoji: "📝" },
        { valor: "evita", rotulo: "Deixo o assunto morrer", emoji: "🌫️" },
        { valor: "compensa", rotulo: "Compenso com atitudes, sem falar", emoji: "🎁" },
      ],
    },
    {
      tipo: "escolha",
      id: "discussao",
      pergunta: "No meio de uma discussão, o que é mais difícil pra você?",
      opcoes: [
        { valor: "ouvir", rotulo: "Ouvir sem interromper", emoji: "👂" },
        { valor: "calma", rotulo: "Manter a calma", emoji: "🌡️" },
        { valor: "dizer", rotulo: "Dizer o que sinto de verdade", emoji: "💗" },
        { valor: "ceder", rotulo: "Admitir que posso estar errado(a)", emoji: "🔄" },
      ],
    },
    {
      tipo: "texto",
      id: "aprendi-onde",
      pergunta: "Onde você aprendeu a lidar com conflito desse jeito?",
      ajuda: "Pense em como era em casa quando você era criança.",
      longo: true,
      placeholder: "Lá em casa, quando tinha briga...",
    },
    {
      tipo: "texto",
      id: "queria",
      pergunta: "O que você gostaria de conseguir fazer diferente?",
      longo: true,
      placeholder: "Eu queria conseguir...",
    },
  ],
  fechamento:
    "Padrão de comunicação não é defeito de caráter — é coisa aprendida, e o que se aprende pode ser trabalhado. Esse material rende bastante numa sessão.",
};

export const JOGOS_DISPONIVEIS: Jogo[] = [
  BALAO_DA_RESPIRACAO,
  TERMOMETRO_DAS_EMOCOES,
  BAU_DAS_FORCAS,
  MONSTRO_DAS_PREOCUPACOES,
  ESPELHO_SEM_FILTRO,
  MOCHILA_DA_PRESSAO,
  PAUSA_DE_TRES_MINUTOS,
  ATERRISSAGEM,
  RODA_DA_VIDA,
  CADERNO_DAS_COISAS_BOAS,
  DETETIVE_DO_PENSAMENTO,
  MAPA_DAS_RELACOES,
  COMO_EU_FALO_QUANDO_DOI,
];

export function getJogo(slug: string): Jogo | undefined {
  return JOGOS_DISPONIVEIS.find((j) => j.slug === slug);
}

/** Respostas no formato salvo: id do passo → o que a pessoa respondeu. */
export type RespostaJogo = Record<
  string,
  string | string[] | Record<string, number> | null
>;
