export type ClientProfile = {
  name: string;
  cpf: string;
  bio: string;
  whatsapp: string;
};

export const defaultClientProfile: ClientProfile = {
  name: "",
  cpf: "",
  bio: "",
  whatsapp: "",
};
