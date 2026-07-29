export type SessionNote = {
  id: string;
  dateTime: string; // ISO string
  content: string;
};

export type Patient = {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string; // yyyy-mm-dd (ou "" se não informado)
  emergencyContact: {
    name: string;
    phone: string;
  };
  sessions: SessionNote[];
};

export type AppointmentStatus =
  | "pendente"
  | "confirmada"
  | "realizada"
  | "desmarcada";

export type ModalidadeAtendimento = "presencial" | "online";

export type PublicBookingDetails = {
  idade: number;
  sexo: string;
  profissao: string;
  telefone: string;
  endereco: string;
  estadoCivil: string;
  escolaridade: string;
  motivo: string;
};

export type Appointment = {
  id: string;
  patientId: string | null;
  patientName: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  status: AppointmentStatus;
  kind: "consulta" | "bloqueio";
  origem?: "publico" | "manual";
  modalidade?: ModalidadeAtendimento;
  detalhes?: PublicBookingDetails;
};

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// "Financeiro / Recibos" ainda não foi migrado para o Supabase (fora do
// escopo da autenticação multi-tenant) — permanece com dados de exemplo.
export const invoices = [
  {
    id: "inv1",
    patientName: "Beatriz Lima Rocha",
    date: isoDateOffset(-7),
    amount: 220,
    status: "pago" as const,
  },
  {
    id: "inv2",
    patientName: "Diego Fernandes Alves",
    date: isoDateOffset(-5),
    amount: 220,
    status: "pago" as const,
  },
  {
    id: "inv3",
    patientName: "Fernanda Costa Pereira",
    date: isoDateOffset(-3),
    amount: 200,
    status: "pendente" as const,
  },
  {
    id: "inv4",
    patientName: "Juliana Ribeiro Santos",
    date: isoDateOffset(-1),
    amount: 220,
    status: "pago" as const,
  },
  {
    id: "inv5",
    patientName: "Gustavo Martins Silva",
    date: isoDateOffset(-15),
    amount: 200,
    status: "pendente" as const,
  },
];
