"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  email: string | null;
  endereco: string | null;
  estado_civil: string | null;
  escolaridade: string | null;
  motivo: string | null;
  motivo_cancelamento: string | null;
};

function rowToAppointment(row: ConsultaRow): Appointment {
  const temDetalhes =
    row.idade != null ||
    row.sexo ||
    row.profissao ||
    row.telefone ||
    row.email ||
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
          email: row.email ?? "",
          endereco: row.endereco ?? "",
          estadoCivil: row.estado_civil ?? "",
          escolaridade: row.escolaridade ?? "",
          motivo: row.motivo ?? "",
        }
      : undefined,
    motivoCancelamento: row.motivo_cancelamento ?? undefined,
  };
}

const SELECT_COLUMNS =
  "id, paciente_id, paciente_nome, data, horario, status, tipo, origem, modalidade, idade, sexo, profissao, telefone, email, endereco, estado_civil, escolaridade, motivo, motivo_cancelamento";

export type CancellationAlert = {
  key: string;
  appointmentId: string;
  patientName: string;
  date: string;
  time: string;
  motivo: string;
};

type AppointmentsContextValue = {
  appointments: Appointment[];
  loading: boolean;
  addAppointment: (appointment: Omit<Appointment, "id">) => Promise<void>;
  updateStatus: (
    id: string,
    status: AppointmentStatus
  ) => Promise<{ patientCreated: boolean }>;
  deleteAppointment: (id: string) => Promise<void>;
  // Consultas que o próprio cliente cancelou, pra Agenda de Hoje avisar o
  // psicólogo com o motivo — populado só via o evento em tempo real abaixo
  // (não sobrevive a um refresh: sem tabela de notificações persistente,
  // só avisa quem já estava com a Agenda aberta no momento do cancelamento).
  cancellationAlerts: CancellationAlert[];
  dismissCancellationAlert: (key: string) => void;
};

const AppointmentsContext = createContext<AppointmentsContextValue | null>(
  null
);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellationAlerts, setCancellationAlerts] = useState<
    CancellationAlert[]
  >([]);
  // Espelha motivoCancelamento por id fora do React state: decidir "isso é
  // uma transição nova" a partir do array `appointments` dentro do updater
  // do setAppointments seria uma função impura (setState de outro estado
  // como efeito colateral) — o StrictMode do React chama updaters duas vezes
  // em dev pra flagrar exatamente isso, e duplicaria o alerta.
  const knownCancelReasons = useRef<Map<string, string | undefined>>(
    new Map()
  );

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from("consultas")
      .select(SELECT_COLUMNS)
      .eq("psicologo_id", user.id)
      .then(({ data }) => {
        if (data) {
          const mapped = (data as ConsultaRow[]).map(rowToAppointment);
          knownCancelReasons.current = new Map(
            mapped.map((a) => [a.id, a.motivoCancelamento])
          );
          setAppointments(mapped);
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

          // motivoCancelamento só existe quando é o CLIENTE cancelando (ver
          // cancelar_consulta_cliente) — o psicólogo mudando o status pela
          // própria Agenda nunca preenche essa coluna, então checar a
          // transição por ela (em vez de só status === "desmarcada") evita
          // alertar o psicólogo sobre a própria ação.
          const motivoCancelamento = appointment.motivoCancelamento;
          const previousMotivo = knownCancelReasons.current.get(appointment.id);
          knownCancelReasons.current.set(appointment.id, motivoCancelamento);
          if (
            appointment.status === "desmarcada" &&
            motivoCancelamento &&
            previousMotivo !== motivoCancelamento
          ) {
            setCancellationAlerts((alerts) => [
              ...alerts,
              {
                key: `${appointment.id}-${motivoCancelamento}`,
                appointmentId: appointment.id,
                patientName: appointment.patientName,
                date: appointment.date,
                time: appointment.time,
                motivo: motivoCancelamento,
              },
            ]);
          }

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
        email: appointment.detalhes?.email ?? null,
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

  async function updateStatus(
    id: string,
    status: AppointmentStatus
  ): Promise<{ patientCreated: boolean }> {
    if (!user) return { patientCreated: false };
    const supabase = createClient();

    // Confirmar uma consulta pública de alguém que ainda não é paciente
    // cadastrado (patientId null) cria o cadastro automaticamente a partir
    // dos dados já preenchidos no agendamento — via RPC pra manter status +
    // criação do paciente atômicos (ver confirmar_consulta_e_criar_paciente
    // no schema.sql). Demais transições de status seguem update direto.
    const current = appointments.find((a) => a.id === id);
    if (status === "confirmada" && current && !current.patientId) {
      const { data, error } = await supabase
        .rpc("confirmar_consulta_e_criar_paciente", { p_consulta_id: id })
        .single();
      if (error) throw new Error(error.message);
      const row = data as { paciente_id: string | null; criado: boolean };
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status, patientId: row.paciente_id } : a
        )
      );
      return { patientCreated: row.criado };
    }

    const { error } = await supabase
      .from("consultas")
      .update({ status })
      .eq("id", id)
      .eq("psicologo_id", user.id);

    if (error) throw new Error(error.message);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    return { patientCreated: false };
  }

  async function deleteAppointment(id: string) {
    if (!user) return;
    const supabase = createClient();

    // .select() depois do delete força o Postgres a devolver as linhas
    // realmente apagadas — sem isso, um delete bloqueado pela RLS (ex.:
    // policy de exclusão ainda não aplicada no banco) retorna sucesso com
    // zero linhas afetadas, e a UI achava que tinha apagado sem ter apagado.
    const { data, error } = await supabase
      .from("consultas")
      .delete()
      .eq("id", id)
      .eq("psicologo_id", user.id)
      .select("id");

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error(
        "A consulta não foi apagada no banco de dados. Confirme se o schema.sql mais recente foi executado no SQL Editor do Supabase."
      );
    }
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }

  function dismissCancellationAlert(key: string) {
    setCancellationAlerts((alerts) => alerts.filter((a) => a.key !== key));
  }

  return (
    <AppointmentsContext.Provider
      value={{
        appointments,
        loading,
        addAppointment,
        updateStatus,
        deleteAppointment,
        cancellationAlerts,
        dismissCancellationAlert,
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
