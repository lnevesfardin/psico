export type CrpStatus = "pendente" | "verificado";

export type Profile = {
  name: string;
  title: string;
  crp: string;
  crpUf: string;
  crpStatus: CrpStatus;
  crpDocumentoPath: string;
  cpf: string;
  photoUrl: string;
  bio: string;
  price: number;
  whatsapp: string;
};

export const defaultProfile: Profile = {
  name: "Dr. Luiz Eduardo",
  title: "Psicólogo Clínico",
  crp: "CRP 06/123456",
  crpUf: "",
  crpStatus: "pendente",
  crpDocumentoPath: "",
  cpf: "",
  photoUrl: "",
  bio: "Atendimento psicológico individual para adultos, com abordagem cognitivo-comportamental focada em ansiedade, autoestima e transições de vida.",
  price: 200,
  whatsapp: "(11) 99999-9999",
};
