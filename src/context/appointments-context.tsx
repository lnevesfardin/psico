"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import type { Appointment, AppointmentStatus } from "@/lib/dashboard-data";

type ConsultaRow = {
  id: string;
  paciente_id: string | null;
  paciente_nome: string;
  data: string;
  horario: string;
  status: AppointmentStatus;
  tipo: Appointment["kind"];
  origem: Appointment["origem"];
  modalidade: Appointment["modalidade"] | null;
  idade: number | null;
  sexo: string | null;
  profissao: string | null;
  telefone: string | null;
  endereco: string | null;
  estado_civil: string | null;
  escolaridade: string | null;
  motivo: string | null;
};

function rowToAppointment(row: ConsultaRow): Appointment {
  const temDetalhes =
    row.idade != null ||
    row.sexo ||
    row.profissao ||
    row.telefone ||
    row.endereco ||
    row.estado_civil ||
    row.escolaridade ||
    row.motivo;

  return {
    id: row.id,
    patientId: row.paciente_id,
    patientName: row.paciente_nome,
    date: row.data,
    time: row.horario.slice(0, 5),
    status: row.status,
    kind: row.tipo,
    origem: row.origem ?? undefined,
    modalidade: row.modalidade ?? undefined,
    detalhes: temDetalhes
      ? {
          idade: row.idade ?? 0,
          sexo: row.sexo ?? "",
          profissao: row.profissao ?? "",
          telefone: row.telefone ?? "",
          endereco: row.endereco ?? "",
          estadoCivil: row.estado_civil ?? "",
          escolaridade: row.escolaridade ?? "",
          motivo: row.motivo ?? "",
        }
      : undefined,
  };
}

const SELECT_COLUMNS =
  "id, paciente_id, paciente_nome, data, horario, status, tipo, origem, modalidade, idade, sexo, profissao, telefone, endereco, estado_civil, escolaridade, motivo";

type AppointmentsContextValue = {
  appointments: Appointment[];
  loading: boolean;
  addAppointment: (appointment: Omit<Appointment, "id">) => Promise<void>;
  updateStatus: (id: string, status: AppointmentStatus) => Promise<void>;
};

const AppointmentsContext = createContext<AppointmentsContextValue | null>(
  null
);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from("consultas")
      .select(SELECT_COLUMNS)
      .eq("psicologo_id", user.id)
      .then(({ data }) => {
        if (data) {
          setAppointments((data as ConsultaRow[]).map(rowToAppointment));
        }
        setLoading(false);
      });

    // Novos agendamentos públicos (feitos em /agendar/[id], sem sessão) e
    // mudanças de status feitas em outro dispositivo aparecem aqui ao vivo.
    const channel = supabase
      .channel(`consultas-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consultas",
          filter: `psicologo_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            setAppointments((prev) => prev.filter((a) => a.id !== oldId));
            return;
          }
          const appointment = rowToAppointment(payload.new as ConsultaRow);
          setAppointments((prev) => {
            const exists = prev.some((a) => a.id === appointment.id);
            return exists
              ? prev.map((a) => (a.id === appointment.id ? appointment : a))
              : [...prev, appointment];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function addAppointment(appointment: Omit<Appointment, "id">) {
    if (!user) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("consultas")
      .insert({
        psicologo_id: user.id,
        paciente_id: appointment.patientId,
        paciente_nome: appointment.patientName,
        data: appointment.date,
        horario: appointment.time,
        status: appointment.status,
        tipo: appointment.kind,
        origem: appointment.origem ?? "manual",
        modalidade: appointment.modalidade ?? null,
        idade: appointment.detalhes?.idade ?? null,
        sexo: appointment.detalhes?.sexo ?? null,
        profissao: appointment.detalhes?.profissao ?? null,
        telefone: appointment.detalhes?.telefone ?? null,
        endereco: appointment.detalhes?.endereco ?? null,
        estado_civil: appointment.detalhes?.estadoCivil ?? null,
        escolaridade: appointment.detalhes?.escolaridade ?? null,
        motivo: appointment.detalhes?.motivo ?? null,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    setAppointments((prev) => [...prev, rowToAppointment(data as ConsultaRow)]);
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    if (!user) return;
    const supabase = createClient();

    const { error } = await supabase
      .from("consultas")
      .update({ status })
      .eq("id", id)
      .eq("psicologo_id", user.id);

    if (error) throw new Error(error.message);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  }

  return (
    <AppointmentsContext.Provider
      value={{
        appointments,
        loading,
        addAppointment,
        updateStatus,
      }}
    >
      {children}
    </AppointmentsContext.Provider>
  );
}

export function useAppointments(): AppointmentsContextValue {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) {
    throw new Error(
      "useAppointments deve ser usado dentro de AppointmentsProvider"
    );
  }
  return ctx;
}
