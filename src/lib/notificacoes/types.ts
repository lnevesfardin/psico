import type { ModalidadeAtendimento } from "@/lib/dashboard-data";

export type Destinatario = "paciente" | "psicologo";
export type Canal = "email" | "webhook";

/**
 * Conteúdo de um lembrete. Só dado de agendamento — nunca prontuário,
 * motivo da consulta, CPF ou qualquer informação clínica (LGPD).
 */
export type TipoLembrete = "lembrete_1h" | "lembrete_24h";

export type LembretePayload = {
  tipo: TipoLembrete;
  consultaId: string;
  destinatario: Destinatario;
  /** yyyy-mm-dd */
  data: string;
  /** HH:mm */
  horario: string;
  modalidade: ModalidadeAtendimento | null;
  pacienteNome: string;
  psicologoNome: string;
  /** Preenchido só quando a consulta é online e o psicólogo cadastrou a sala. */
  salaUrl: string | null;
  /** Preenchidos só quando a consulta é presencial e há consultório. */
  enderecoConsultorio: string | null;
  mapsUrl: string | null;
  /**
   * Complemento curto configurado pelo psicólogo (ver
   * configuracao_notificacoes.mensagem_extra) — nunca o template inteiro,
   * de propósito (ver comentário em schema.sql sobre por que isso é
   * restrito a um complemento, não uma substituição total).
   */
  mensagemExtra: string | null;
};

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; erro: string };

/** E-mail avisando o psicólogo que o cliente cancelou uma consulta. */
export type CancelamentoPayload = {
  psicologoNome: string;
  pacienteNome: string;
  /** yyyy-mm-dd */
  data: string;
  /** HH:mm */
  horario: string;
  motivo: string;
};
