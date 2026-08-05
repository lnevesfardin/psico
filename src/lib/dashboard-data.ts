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
  hasInsurance: boolean;
  insuranceName: string;
  firstAppointmentDate: string; // yyyy-mm-dd (ou "" se não informado)
  escolaridade: string;
  comoConheceu: string;
  observacoes: string;
  sessions: SessionNote[];
  // Conta de login do cliente vinculada manualmente pelo psicólogo (ver
  // vincular_paciente_cliente no schema.sql) — null se ainda não vinculado.
  clienteUserId: string | null;
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
  // Preenchido só quando o próprio cliente cancela (ver
  // cancelar_consulta_cliente no schema.sql) — nunca em mudanças de status
  // feitas pelo psicólogo.
  motivoCancelamento?: string;
};

