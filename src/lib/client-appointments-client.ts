import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentStatus, ModalidadeAtendimento } from "@/lib/dashboard-data";

export type ClientAppointment = {
  id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  status: AppointmentStatus;
  modalidade: ModalidadeAtendimento | null;
  psicologoId: string;
  psicologoNome: string;
  psicologoTitulo: string;
  psicologoFotoUrl: string | null;
  motivoCancelamento: string | null;
};

type ConsultaRow = {
  id: string;
  psicologo_id: string;
  data: string;
  horario: string;
  status: AppointmentStatus;
  modalidade: ModalidadeAtendimento | null;
  motivo_cancelamento: string | null;
};

type PerfilPublicoRow = {
  id: string;
  nome: string;
  titulo: string;
  foto_url: string | null;
};

const CONSULTA_COLUMNS =
  "id, psicologo_id, data, horario, status, modalidade, motivo_cancelamento";

export async function listClientAppointments(
  supabase: SupabaseClient,
  clienteId: string
): Promise<ClientAppointment[]> {
  const { data: consultas, error } = await supabase
    .from("consultas")
    .select(CONSULTA_COLUMNS)
    .eq("cliente_id", clienteId)
    .eq("tipo", "consulta")
    .order("data", { ascending: false })
    .order("horario", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (consultas ?? []) as ConsultaRow[];
  if (rows.length === 0) return [];

  const psicologoIds = [...new Set(rows.map((r) => r.psicologo_id))];
  const { data: perfis } = await supabase.rpc("perfis_publico", { p_ids: psicologoIds });

  const perfisById = new Map(
    ((perfis ?? []) as PerfilPublicoRow[]).map((p) => [p.id, p])
  );

  return rows.map((row) => {
    const perfil = perfisById.get(row.psicologo_id);
    return {
      id: row.id,
      date: row.data,
      time: row.horario.slice(0, 5),
      status: row.status,
      modalidade: row.modalidade,
      psicologoId: row.psicologo_id,
      psicologoNome: perfil?.nome ?? "Psicólogo",
      psicologoTitulo: perfil?.titulo ?? "",
      psicologoFotoUrl: perfil?.foto_url ?? null,
      motivoCancelamento: row.motivo_cancelamento,
    };
  });
}

/**
 * Cancela um agendamento próprio (pendente ou confirmado) via RPC — cliente
 * não tem policy de UPDATE em "consultas" de propósito, ver
 * cancelar_consulta_cliente no schema.sql. O motivo é obrigatório: a função
 * rejeita string vazia.
 */
export async function cancelAppointment(
  supabase: SupabaseClient,
  consultaId: string,
  motivo: string
): Promise<void> {
  const { error } = await supabase.rpc("cancelar_consulta_cliente", {
    p_consulta_id: consultaId,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);

  // Best-effort: avisa o psicólogo por e-mail. Não bloqueia nem falha o
  // cancelamento (que já está salvo no banco) se o envio der errado.
  fetch("/api/notificacoes/cancelamento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consultaId }),
  }).catch(() => {});
}

/**
 * Confirma presença numa consulta pendente — mesmo motivo de
 * cancelAppointment, passa por RPC (ver confirmar_consulta_cliente no
 * schema.sql) porque o cliente não tem policy de UPDATE em "consultas".
 */
export async function confirmAppointment(
  supabase: SupabaseClient,
  consultaId: string
): Promise<void> {
  const { error } = await supabase.rpc("confirmar_consulta_cliente", {
    p_consulta_id: consultaId,
  });
  if (error) throw new Error(error.message);
}
