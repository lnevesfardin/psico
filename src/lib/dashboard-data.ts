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

export type PaymentStatus = "pago" | "pendente";

export type PublicBookingDetails = {
  idade: number;
  sexo: string;
  profissao: string;
  telefone: string;
  email: string;
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

