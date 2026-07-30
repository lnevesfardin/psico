"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Ban,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  BellRing,
  MessageCircle,
  Globe,
  MapPin,
  Video,
  Trash2,
} from "lucide-react";
import type { Appointment, AppointmentStatus, Patient } from "@/lib/dashboard-data";
import { formatDateLabel, formatDateShort, nextDays, todayIso, toWhatsappLink } from "@/lib/format";
import { weekdayShort } from "@/lib/working-hours-data";
import { useAppointments } from "@/context/appointments-context";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listPatients } from "@/lib/patients-client";
import { TimeSelect } from "@/components/ui/time-select";

type MonthCell = { iso: string; day: number; inMonth: boolean };

function buildMonthGrid(year: number, month: number): MonthCell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    return { iso, day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

const statusStyles: Record<AppointmentStatus, string> = {
  pendente:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  confirmada:
    "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  realizada:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  desmarcada:
    "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export default function AgendaPage() {
  const { user } = useAuth();
  const { appointments, addAppointment, updateStatus, deleteAppointment } =
    useAppointments();
  const { profile } = useProfile();
  const [view, setView] = useState<"hoje" | "semana" | "mes">("hoje");
  const [modalOpen, setModalOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const seenPendingIds = useRef<Set<string> | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(todayIso());

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listPatients(supabase, user.id).then(setPatients);
  }, [user]);

  function getPhone(item: Appointment): string | undefined {
    return item.detalhes?.telefone ?? patients.find((p) => p.id === item.patientId)?.phone;
  }

  const today = todayIso();
  const weekDays = useMemo(() => nextDays(7), []);

  const pendingAppointments = useMemo(
    () => appointments.filter((a) => a.status === "pendente"),
    [appointments]
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (seenPendingIds.current === null) {
      seenPendingIds.current = new Set(pendingAppointments.map((a) => a.id));
      return;
    }
    const newOnes = pendingAppointments.filter(
      (a) => !seenPendingIds.current!.has(a.id)
    );
    if (newOnes.length > 0 && Notification.permission === "granted") {
      for (const appt of newOnes) {
        new Notification("Novo agendamento pelo site", {
          body: `${appt.patientName} · ${formatDateShort(appt.date)} às ${appt.time}`,
        });
      }
    }
    seenPendingIds.current = new Set(pendingAppointments.map((a) => a.id));
  }, [pendingAppointments]);

  const grouped = useMemo(() => {
    const days =
      view === "hoje" ? [today] : view === "semana" ? weekDays : [selectedDay];
    return days.map((date) => ({
      date,
      items: appointments
        .filter((a) => a.date === date)
        .sort((a, b) => a.time.localeCompare(b.time)),
    }));
  }, [appointments, view, today, weekDays, selectedDay]);

  const monthGrid = useMemo(
    () => buildMonthGrid(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor]
  );

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      map.set(a.date, (map.get(a.date) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const monthLabel = useMemo(() => {
    const label = monthCursor.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [monthCursor]);

  function goToPrevMonth() {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  async function handleCreate(newAppointment: Omit<Appointment, "id">) {
    await addAppointment(newAppointment);
    setModalOpen(false);
  }

  function handleConfirmViaWhatsapp(item: Appointment) {
    updateStatus(item.id, "confirmada");
    const phone = getPhone(item);
    if (!phone) return;
    const message = `Olá ${item.patientName}! Aqui é ${profile.name}. Sua consulta no dia ${formatDateShort(item.date)} às ${item.time} está confirmada. Até lá!`;
    window.open(toWhatsappLink(phone, message), "_blank");
  }

  async function handleDelete(item: Appointment) {
    const label = item.kind === "bloqueio" ? "este bloqueio" : "esta consulta";
    const confirmed = window.confirm(
      `Tem certeza que deseja apagar ${label} (${item.patientName}, ${formatDateShort(item.date)} às ${item.time})?`
    );
    if (!confirmed) return;
    setDeletingIds((prev) => new Set(prev).add(item.id));
    try {
      await deleteAppointment(item.id);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Consultas de hoje, da semana e do mês.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nova Consulta / Bloqueio de Horário
        </button>
      </div>

      {pendingAppointments.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <BellRing className="h-4 w-4 shrink-0" />
          Você tem {pendingAppointments.length} agendamento(s) pendente(s) de
          confirmação, feito(s) pelo site.
        </div>
      )}

      <div className="mt-6 inline-flex rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {(["hoje", "semana", "mes"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v
                ? "bg-brand-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {v === "hoje" ? "Hoje" : v === "semana" ? "Esta semana" : "Mês"}
          </button>
        ))}
      </div>

      {view === "mes" && (
        <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Mês anterior"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Próximo mês"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400">
            {weekdayShort.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid.map(({ iso, day, inMonth }) => {
              const count = countsByDate.get(iso) ?? 0;
              const isToday = iso === today;
              const isSelected = iso === selectedDay;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-sm transition-colors ${
                    !inMonth
                      ? "text-zinc-300 dark:text-zinc-700"
                      : isSelected
                        ? "bg-brand-600 text-white"
                        : isToday
                          ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {day}
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      count === 0
                        ? "bg-transparent"
                        : isSelected
                          ? "bg-white"
                          : "bg-brand-600 dark:bg-brand-400"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {grouped.map(({ date, items }) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {date === today ? "Hoje, " : ""}
              {formatDateLabel(date)}
            </h2>
            <div className="mt-3 space-y-3">
              {items.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                  Nenhuma consulta agendada.
                </p>
              )}
              {items.map((item) => {
                const isBlock = item.kind === "bloqueio";
                const isPublic = item.origem === "publico";
                const isPending = item.status === "pendente";
                const row = (
                  <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-4">
                      <div className="flex w-16 shrink-0 items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        <Clock className="h-4 w-4 text-zinc-400" />
                        {item.time}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-medium ${
                            isBlock
                              ? "italic text-zinc-500 dark:text-zinc-500"
                              : "text-zinc-900 dark:text-white"
                          }`}
                        >
                          {isBlock && <Ban className="mr-1.5 inline h-4 w-4" />}
                          {item.patientName}
                          {isPublic && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              <Globe className="h-3 w-3" />
                              via site
                            </span>
                          )}
                          {item.modalidade && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              {item.modalidade === "presencial" ? (
                                <MapPin className="h-3 w-3" />
                              ) : (
                                <Video className="h-3 w-3" />
                              )}
                              {item.modalidade === "presencial" ? "Presencial" : "Online"}
                            </span>
                          )}
                        </p>
                      </div>
                      <select
                        value={item.status}
                        onClick={(e) => e.preventDefault()}
                        onChange={(e) =>
                          updateStatus(
                            item.id,
                            e.target.value as AppointmentStatus
                          )
                        }
                        className={`shrink-0 rounded-full border-0 px-3 py-1 text-xs font-semibold ${statusStyles[item.status]}`}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="realizada">Realizada</option>
                        <option value="desmarcada">Desmarcada</option>
                      </select>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(item);
                        }}
                        disabled={deletingIds.has(item.id)}
                        aria-label={isBlock ? "Apagar bloqueio" : "Apagar consulta"}
                        className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {!isBlock && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
                      )}
                    </div>

                    {item.detalhes && (
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-950/50 dark:text-zinc-400 sm:grid-cols-4">
                        <span>Idade: {item.detalhes.idade}</span>
                        <span>Sexo: {item.detalhes.sexo}</span>
                        <span>Profissão: {item.detalhes.profissao}</span>
                        <span>Tel: {item.detalhes.telefone}</span>
                        <span className="col-span-2 sm:col-span-2">
                          Endereço: {item.detalhes.endereco}
                        </span>
                        <span>Est. civil: {item.detalhes.estadoCivil}</span>
                        <span>Escolaridade: {item.detalhes.escolaridade}</span>
                        {item.detalhes.motivo && (
                          <span className="col-span-2 sm:col-span-4">
                            Motivo: {item.detalhes.motivo}
                          </span>
                        )}
                      </div>
                    )}

                    {isPending && getPhone(item) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleConfirmViaWhatsapp(item);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Confirmar via WhatsApp
                      </button>
                    )}
                  </div>
                );

                return item.patientId ? (
                  <Link key={item.id} href={`/dashboard/pacientes/${item.patientId}`}>
                    {row}
                  </Link>
                ) : (
                  <div key={item.id}>{row}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <NewAppointmentModal
          patients={patients}
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function NewAppointmentModal({
  patients,
  onClose,
  onCreate,
}: {
  patients: Patient[];
  onClose: () => void;
  onCreate: (appointment: Omit<Appointment, "id">) => Promise<void>;
}) {
  const [kind, setKind] = useState<"consulta" | "bloqueio">("consulta");
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const patient = patients.find((p) => p.id === patientId);
    try {
      await onCreate({
        patientId: kind === "consulta" ? patientId : null,
        patientName:
          kind === "consulta" ? patient?.name ?? "Paciente" : "Horário reservado",
        date,
        time,
        status: "confirmada",
        kind,
        origem: "manual",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Nova Consulta / Bloqueio
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 inline-flex w-full rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {(["consulta", "bloqueio"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                kind === k
                  ? "bg-brand-600 text-white"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {k === "consulta" ? "Consulta" : "Bloqueio de horário"}
            </button>
          ))}
        </div>

        {kind === "consulta" && (
          <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Paciente
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Data
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Horário
            <TimeSelect value={time} onChange={setTime} required />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
