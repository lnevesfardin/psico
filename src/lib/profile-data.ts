export type Profile = {
  name: string;
  title: string;
  crp: string;
  uf: string;
  photoUrl: string;
  bio: string;
  price: number;
  whatsapp: string;
};

export const defaultProfile: Profile = {
  name: "Dr. Luiz Eduardo",
  title: "Psicólogo Clínico",
  crp: "CRP 06/123456",
  uf: "SP",
  photoUrl: "",
  bio: "Atendimento psicológico individual para adultos, com abordagem cognitivo-comportamental focada em ansiedade, autoestima e transições de vida.",
  price: 200,
  whatsapp: "(11) 99999-9999",
};
