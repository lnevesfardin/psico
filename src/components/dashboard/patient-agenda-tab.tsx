"use client";

import { Calendar } from "lucide-react";
import { useAppointments } from "@/context/appointments-context";
import { formatDateShort } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/dashboard-data";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  realizada: "Realizada",
  desmarcada: "Desmarcada",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  pendente: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  confirmada: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  realizada:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  desmarcada: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

// Só leitura: a edição de agendamentos continua sendo feita na Agenda
// principal do dashboard — aqui é o histórico/próximas consultas deste
// paciente específico, reaproveitando o AppointmentsProvider que já busca
// todas as consultas do psicólogo (sem round-trip novo ao banco).
export function PatientAgendaTab({ patientId }: { patientId: string }) {
  const { appointments, loading } = useAppointments();

  const doPaciente = appointments
    .filter((a) => a.patientId === patientId && a.kind === "consulta")
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

  if (loading) {
    return (
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        Carregando...
      </p>
    );
  }

  if (doPaciente.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Nenhum agendamento para este paciente ainda.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      {doPaciente.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {formatDateShort(a.date)} às {a.time}
            </p>
            {a.modalidade && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {a.modalidade === "online" ? "Online" : "Presencial"}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[a.status]}`}
          >
            {STATUS_LABEL[a.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
