import type { ModalidadeAtendimento } from "@/lib/dashboard-data";

export type Destinatario = "paciente" | "psicologo";
export type Canal = "email" | "webhook";

/**
 * Conteúdo de um lembrete. Só dado de agendamento — nunca prontuário,
 * motivo da consulta, CPF ou qualquer informação clínica (LGPD).
 */
export type LembretePayload = {
  tipo: "lembrete_1h";
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
};

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; erro: string };
