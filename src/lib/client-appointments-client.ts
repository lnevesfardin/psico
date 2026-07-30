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
};

type ConsultaRow = {
  id: string;
  psicologo_id: string;
  data: string;
  horario: string;
  status: AppointmentStatus;
  modalidade: ModalidadeAtendimento | null;
};

type PerfilPublicoRow = {
  id: string;
  nome: string;
  titulo: string;
  foto_url: string | null;
};

const CONSULTA_COLUMNS = "id, psicologo_id, data, horario, status, modalidade";

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
  const { data: perfis } = await supabase
    .from("perfis_publico")
    .select("id, nome, titulo, foto_url")
    .in("id", psicologoIds);

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
    };
  });
}
