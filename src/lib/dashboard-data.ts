export type SessionNote = {
  id: string;
  dateTime: string; // ISO string — quando a sessão aconteceu, nunca muda ao editar
  content: string;
  // "transcricao" = texto vindo da transcrição automática do áudio da sessão,
  // revisado pelo psicólogo antes de salvar; "manual" = digitado por ele.
  origem: "manual" | "transcricao";
  // Diferente de dateTime quando a anotação foi editada depois de criada.
  updatedAt: string;
};

/** Ficha de uma pessoa, de um casal ou de um grupo (ver "tipo" no schema). */
export type TipoFicha = "individuo" | "casal" | "grupo";

/** Classificação feita pelo psicólogo — o sistema nunca deduz. */
export type Complexidade = "baixa" | "media" | "alta";

export const TIPO_FICHA_LABELS: Record<TipoFicha, string> = {
  individuo: "Indivíduo",
  casal: "Casal",
  grupo: "Grupo",
};

export const COMPLEXIDADE_LABELS: Record<Complexidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

/** Integrante de uma ficha de casal/grupo; não tem prontuário próprio. */
export type Participante = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
};

export type Patient = {
  id: string;
  tipo: TipoFicha;
  complexidade: Complexidade | null;
  participantes: Participante[];
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
  /**
   * Resumo das sessões para a listagem, que de propósito não carrega o
   * conteúdo das evoluções (dado sigiloso não precisa trafegar para montar
   * uma lista). Na ficha aberta, vêm das próprias sessions.
   */
  totalSessoes: number;
  ultimaSessaoEm: string | null;
  // Conta de login do cliente vinculada manualmente pelo psicólogo (ver
  // convites_paciente no schema.sql) — null se ainda não vinculado.
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
  comoConheceu: string;
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
  // Presente quando a ocorrência veio de uma recorrência (ver
  // recorrencias-client.ts) — não null quando kind="consulta" e a consulta
  // faz parte de uma série semanal/quinzenal.
  recorrenciaId?: string | null;
};

export type Recorrencia = {
  id: string;
  psicologoId: string;
  patientId: string;
  patientName: string;
  diaSemana: number; // 0=domingo .. 6=sábado
  horario: string; // HH:mm
  modalidade: ModalidadeAtendimento | null;
  intervaloSemanas: 1 | 2;
  inicio: string; // yyyy-mm-dd
  fim: string | null;
  ativa: boolean;
};

