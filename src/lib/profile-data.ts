export type Profile = {
  name: string;
  title: string;
  crp: string;
  uf: string;
  cidade: string;
  photoUrl: string;
  /** Timbrado dos documentos emitidos — separado da foto de perfil. */
  logoUrl: string;
  bio: string;
  price: number;
  whatsapp: string;
  especialidades: string[];
  abordagens: string[];
  faixasEtarias: string[];
  temConsultorio: boolean;
  consultorioRua: string;
  consultorioNumero: string;
  consultorioBairro: string;
  consultorioCidade: string;
  consultorioUf: string;
  consultorioMapsUrl: string;
  salaOnlineUrl: string;
};

export const defaultProfile: Profile = {
  name: "",
  title: "Psicólogo Clínico",
  crp: "CRP 06/123456",
  uf: "SP",
  cidade: "",
  photoUrl: "",
  logoUrl: "",
  bio: "Atendimento psicológico individual para adultos, com abordagem cognitivo-comportamental focada em ansiedade, autoestima e transições de vida.",
  price: 200,
  whatsapp: "(11) 99999-9999",
  especialidades: [],
  abordagens: [],
  faixasEtarias: [],
  temConsultorio: false,
  consultorioRua: "",
  consultorioNumero: "",
  consultorioBairro: "",
  consultorioCidade: "",
  consultorioUf: "",
  consultorioMapsUrl: "",
  salaOnlineUrl: "",
};
