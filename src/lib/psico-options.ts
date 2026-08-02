export const especialidadesOptions = [
  "Ansiedade",
  "Depressão",
  "Luto",
  "Relacionamentos",
  "Autoestima",
  "Estresse",
  "Burnout",
  "TDAH",
  "TOC",
  "Transtornos alimentares",
  "Dependência química",
  "Traumas",
  "Sexualidade",
  "Identidade de gênero",
  "Orientação de carreira",
] as const;

export type Especialidade = (typeof especialidadesOptions)[number];

export const abordagensOptions = [
  "Terapia Cognitivo-Comportamental (TCC)",
  "Psicanálise",
  "Humanista",
  "Gestalt-terapia",
  "Sistêmica",
  "Analítico-Comportamental (ABA)",
  "Terapia Comportamental Dialética (DBT)",
] as const;

export type Abordagem = (typeof abordagensOptions)[number];

export const faixasEtariasOptions = [
  "Infantil",
  "Adolescentes",
  "Adultos",
  "Idosos",
] as const;

export type FaixaEtaria = (typeof faixasEtariasOptions)[number];
