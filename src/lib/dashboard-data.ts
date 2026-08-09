export type FormatoEvolucao = "dap" | "soap" | "birp" | "livre";
export type StatusEvolucao = "rascunho" | "assinada";

export type Adendo = {
  id: string;
  evolucaoId: string;
  texto: string;
  motivo: string | null;
  createdAt: string; // ISO string
};

export type SessionNote = {
  id: string;
  dateTime: string; // ISO string
  content: string;
  // "transcricao" = texto vindo da transcrição automática do áudio da sessão,
  // revisado pelo psicólogo antes de salvar; "manual" = digitado por ele.
  origem: "manual" | "transcricao";
  formato: FormatoEvolucao;
  status: StatusEvolucao;
  assinadoEm: string | null; // ISO string, null enquanto for rascunho
  agendamentoId: string | null;
  adendos: Adendo[];
};

export type PatientStatus = "ativo" | "pausado" | "alta" | "desistencia";

export type PatientAddress = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type Patient = {
  id: string;
  name: string;
  nomeSocial: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string; // yyyy-mm-dd (ou "" se não informado)
  genero: string;
  endereco: PatientAddress | null;
  emergencyContact: {
    name: string;
    phone: string;
  };
  // Obrigatórios na UI quando o paciente é menor de idade (ver isMinor() em
  // patients-client.ts) — dado do responsável legal, não do próprio paciente.
  responsavel: {
    nome: string;
    cpf: string;
    parentesco: string;
  };
  hasInsurance: boolean;
  insuranceName: string;
  firstAppointmentDate: string; // yyyy-mm-dd (ou "" se não informado)
  escolaridade: string;
  comoConheceu: string;
  queixaInicial: string;
  encaminhadoPor: string;
  valorSessao: number | null;
  frequenciaPadrao: string;
  observacoes: string;
  status: PatientStatus;
  arquivadoEm: string | null; // ISO string, null = ativo no fluxo (não arquivado)
  sessions: SessionNote[];
  // Conta de login do cliente vinculada manualmente pelo psicólogo (ver
  // convites_paciente no schema.sql) — null se ainda não vinculado.
  clienteUserId: string | null;
};

export type AppointmentStatus =
  | "pendente"
  | "confirmada"
  | "realizada"
  | "falta"
  | "desmarcada";

export type ModalidadeAtendimento = "presencial" | "online";

export type PaymentStatus = "pago" | "pendente" | "cancelado";
export type TipoLancamento = "receita" | "despesa";
export type CategoriaLancamento =
  | "sessao"
  | "pacote"
  | "aluguel"
  | "supervisao"
  | "software"
  | "imposto"
  | "outro";
export type FormaPagamento = "pix" | "cartao" | "dinheiro" | "transferencia";

export type PacoteSessao = {
  id: string;
  patientId: string;
  patientName: string;
  quantidadeSessoes: number;
  sessoesUsadas: number;
  valorTotal: number;
  validade: string | null; // yyyy-mm-dd
};

export type Recibo = {
  id: string;
  patientId: string;
  numero: number;
  competenciaInicio: string; // yyyy-mm-dd
  competenciaFim: string;
  valorTotal: number;
  quantidadeSessoes: number;
  pagadorNome: string;
  pagadorCpf: string;
  emitidoEm: string; // ISO string
};

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

