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
  UserPlus,
  CalendarX,
  Repeat,
  CalendarClock,
} from "lucide-react";
import { ListaEsperaPanel } from "@/components/dashboard/lista-espera-panel";
import type {
  Appointment,
  AppointmentStatus,
  ModalidadeAtendimento,
  Patient,
} from "@/lib/dashboard-data";
import { formatDateLabel, formatDateShort, nextDays, todayIso, toWhatsappLink } from "@/lib/format";
import { weekdayShort } from "@/lib/disponibilidade-data";
import { useAppointments } from "@/context/appointments-context";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listPatients } from "@/lib/patients-client";
import {
  converterEmRecorrente,
  createRecorrenciaComOcorrencias,
  deactivateRecorrencia,
} from "@/lib/recorrencias-client";
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
  const {
    appointments,
    addAppointment,
    updateStatus,
    deleteAppointment,
    setRecorrencia,
    cancellationAlerts,
    dismissCancellationAlert,
  } = useAppointments();
  const { profile } = useProfile();
  const [view, setView] = useState<"hoje" | "semana" | "mes">("hoje");
  const [modalOpen, setModalOpen] = useState(false);
  const [listaEsperaOpen, setListaEsperaOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [patientCreatedToast, setPatientCreatedToast] = useState<string | null>(
    null
  );
  const [convertingItem, setConvertingItem] = useState<Appointment | null>(null);
  const [togglingRecorrenciaIds, setTogglingRecorrenciaIds] = useState<Set<string>>(
    new Set()
  );
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
    if (!patientCreatedToast) return;
    const timeout = setTimeout(() => setPatientCreatedToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [patientCreatedToast]);

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

  async function handleCreateRecorrente(input: {
    patientId: string;
    patientName: string;
    diaSemana: number;
    horario: string;
    modalidade: ModalidadeAtendimento | null;
    intervaloSemanas: 1 | 2;
    inicio: string;
    fim: string | null;
  }) {
    if (!user) return;
    const supabase = createClient();
    const { criadas, conflitos } = await createRecorrenciaComOcorrencias(
      supabase,
      user.id,
      { ...input, maxOcorrenciasIniciais: 12 }
    );
    setModalOpen(false);
    if (conflitos > 0) {
      window.alert(
        `Série criada: ${criadas} consulta(s) agendada(s). ${conflitos} data(s) já tinham outro horário marcado e foram puladas.`
      );
    }
  }

  // Transforma uma consulta avulsa já existente na primeira ocorrência de
  // uma série — pensado pro caso de agenda já preenchida (ex.: uma lista de
  // pacientes de um dia fixo lançada avulsa) que o psicólogo decide depois
  // que precisa virar recorrente, sem reagendar nada na mão.
  async function handleTornarRecorrente(input: {
    intervaloSemanas: 1 | 2;
    fim: string | null;
  }) {
    if (!user || !convertingItem) return;
    const item = convertingItem;
    const supabase = createClient();
    const { recorrenciaId, criadas, conflitos } = await converterEmRecorrente(
      supabase,
      user.id,
      {
        patientId: item.patientId!,
        patientName: item.patientName,
        data: item.date,
        horario: item.time,
        modalidade: item.modalidade ?? null,
        intervaloSemanas: input.intervaloSemanas,
        fim: input.fim,
        maxOcorrenciasIniciais: 12,
      }
    );
    await setRecorrencia(item.id, recorrenciaId);
    setConvertingItem(null);
    if (conflitos > 0) {
      window.alert(
        `Série criada: ${criadas} consulta(s) futura(s) agendada(s). ${conflitos} data(s) já tinham outro horário marcado e foram puladas.`
      );
    }
  }

  // Para a repetição a partir desta ocorrência: desativa a recorrência,
  // apaga as próximas já geradas (a atual fica intacta, só desvinculada).
  async function handleTornarAvulsa(item: Appointment) {
    if (!item.recorrenciaId) return;
    const confirmed = window.confirm(
      "Parar a repetição a partir daqui? As próximas ocorrências já criadas dessa série serão removidas — esta consulta continua, só deixa de fazer parte da série."
    );
    if (!confirmed) return;

    const recorrenciaId = item.recorrenciaId;
    setTogglingRecorrenciaIds((prev) => new Set(prev).add(item.id));
    try {
      const supabase = createClient();
      const futuras = appointments.filter(
        (a) => a.recorrenciaId === recorrenciaId && a.id !== item.id && a.date >= today
      );
      for (const futura of futuras) {
        await deleteAppointment(futura.id);
      }
      await deactivateRecorrencia(supabase, recorrenciaId);
      await setRecorrencia(item.id, null);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Não foi possível parar a repetição."
      );
    } finally {
      setTogglingRecorrenciaIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // Ponto único pra mudança de status a partir da UI (select e botão do
  // WhatsApp passam por aqui): mostra o toast de "paciente cadastrado"
  // sempre que a confirmação criar um paciente novo, não só no caminho do
  // WhatsApp — o psicólogo pode confirmar por qualquer um dos dois.
  async function handleStatusChange(item: Appointment, status: AppointmentStatus) {
    const result = await updateStatus(item.id, status);
    if (result.patientCreated) {
      setPatientCreatedToast(item.patientName);
    }
  }

  async function handleConfirmViaWhatsapp(item: Appointment) {
    await handleStatusChange(item, "confirmada");
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
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Não foi possível apagar."
      );
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
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setListaEsperaOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Clock className="h-4 w-4" />
            Lista de Espera
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Nova Consulta / Bloqueio de Horário
          </button>
        </div>
      </div>

      {listaEsperaOpen && (
        <ListaEsperaPanel onClose={() => setListaEsperaOpen(false)} />
      )}

      {pendingAppointments.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <BellRing className="h-4 w-4 shrink-0" />
          Você tem {pendingAppointments.length} agendamento(s) pendente(s) de
          confirmação, feito(s) pelo site.
        </div>
      )}

      {cancellationAlerts.length > 0 && (
        <div className="mt-6 space-y-2">
          {cancellationAlerts.map((alert) => (
            <div
              key={alert.key}
              className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <CalendarX className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>
                  <strong className="font-semibold">{alert.patientName}</strong>{" "}
                  cancelou a consulta de {formatDateLabel(alert.date)} às{" "}
                  {alert.time}.
                </p>
                <p className="mt-0.5 text-rose-700/90 dark:text-rose-300/80">
                  Motivo: {alert.motivo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissCancellationAlert(alert.key)}
                aria-label="Dispensar aviso"
                className="shrink-0 rounded-full p-1 text-rose-500 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex min-w-0 items-center gap-4 sm:flex-1">
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
                            {!isBlock && item.recorrenciaId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleTornarAvulsa(item);
                                }}
                                disabled={togglingRecorrenciaIds.has(item.id)}
                                title="Faz parte de uma série recorrente — clique para parar a repetição"
                                className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                              >
                                <Repeat className="h-3 w-3" />
                                Série
                              </button>
                            )}
                            {!isBlock && !item.recorrenciaId && item.patientId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setConvertingItem(item);
                                }}
                                title="Consulta avulsa — clique para transformar em série recorrente"
                                className="ml-2 inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-brand-500 dark:hover:text-brand-400"
                              >
                                <Repeat className="h-3 w-3" />
                                Avulsa
                              </button>
                            )}
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
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                        <select
                          value={item.status}
                          onClick={(e) => e.preventDefault()}
                          onChange={(e) =>
                            handleStatusChange(
                              item,
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
                        <div className="flex shrink-0 items-center gap-1">
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
                      </div>
                    </div>

                    {item.detalhes && (
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-950/50 dark:text-zinc-400 sm:grid-cols-4">
                        <span>Idade: {item.detalhes.idade}</span>
                        <span>Sexo: {item.detalhes.sexo}</span>
                        <span>Profissão: {item.detalhes.profissao}</span>
                        <span>Tel: {item.detalhes.telefone}</span>
                        {item.detalhes.email && (
                          <span>E-mail: {item.detalhes.email}</span>
                        )}
                        <span className="col-span-2 sm:col-span-2">
                          Endereço: {item.detalhes.endereco}
                        </span>
                        <span>Est. civil: {item.detalhes.estadoCivil}</span>
                        <span>Escolaridade: {item.detalhes.escolaridade}</span>
                        {item.detalhes.comoConheceu && (
                          <span className="col-span-2 sm:col-span-2">
                            Como conheceu: {item.detalhes.comoConheceu}
                          </span>
                        )}
                        {item.detalhes.motivo && (
                          <span className="col-span-2 sm:col-span-4">
                            Motivo: {item.detalhes.motivo}
                          </span>
                        )}
                      </div>
                    )}

                    {item.status === "desmarcada" && item.motivoCancelamento && (
                      <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        Cancelado pelo paciente — motivo: {item.motivoCancelamento}
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
          onCreateRecorrente={handleCreateRecorrente}
        />
      )}

      {convertingItem && (
        <TornarRecorrenteModal
          item={convertingItem}
          onClose={() => setConvertingItem(null)}
          onConfirm={handleTornarRecorrente}
        />
      )}

      {patientCreatedToast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900">
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">{patientCreatedToast}</strong>{" "}
            foi adicionado em Pacientes &amp; Prontuários.
          </span>
        </div>
      )}
    </div>
  );
}

function NewAppointmentModal({
  patients,
  onClose,
  onCreate,
  onCreateRecorrente,
}: {
  patients: Patient[];
  onClose: () => void;
  onCreate: (appointment: Omit<Appointment, "id">) => Promise<void>;
  onCreateRecorrente: (input: {
    patientId: string;
    patientName: string;
    diaSemana: number;
    horario: string;
    modalidade: ModalidadeAtendimento | null;
    intervaloSemanas: 1 | 2;
    inicio: string;
    fim: string | null;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<"consulta" | "bloqueio">("consulta");
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("09:00");
  const [frequenciaConsulta, setFrequenciaConsulta] = useState<"avulsa" | "recorrente">("avulsa");
  const [intervaloSemanas, setIntervaloSemanas] = useState<1 | 2>(1);
  const [repetirAte, setRepetirAte] = useState("");
  const [modalidade, setModalidade] = useState<ModalidadeAtendimento | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const patient = patients.find((p) => p.id === patientId);
    try {
      if (kind === "consulta" && frequenciaConsulta === "recorrente") {
        const [y, m, d] = date.split("-").map(Number);
        const diaSemana = new Date(y, m - 1, d).getDay();
        await onCreateRecorrente({
          patientId,
          patientName: patient?.name ?? "Paciente",
          diaSemana,
          horario: time,
          modalidade,
          intervaloSemanas,
          inicio: date,
          fim: repetirAte || null,
        });
        return;
      }

      await onCreate({
        patientId: kind === "consulta" ? patientId : null,
        patientName:
          kind === "consulta" ? patient?.name ?? "Paciente" : "Horário reservado",
        date,
        time,
        status: "confirmada",
        kind,
        origem: "manual",
        modalidade: kind === "consulta" ? modalidade ?? undefined : undefined,
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

        {kind === "consulta" && (
          <div className="mt-4">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Modalidade{" "}
              <span className="font-normal text-zinc-400">
                (define o que vai no lembrete: link da sala ou endereço)
              </span>
            </span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {([null, "presencial", "online"] as const).map((m) => (
                <button
                  key={m ?? "indefinida"}
                  type="button"
                  onClick={() => setModalidade(m)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors ${
                    modalidade === m
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {m === "presencial" && <MapPin className="h-4 w-4" />}
                  {m === "online" && <Video className="h-4 w-4" />}
                  {m === null ? "Não informar" : m === "presencial" ? "Presencial" : "Online"}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "consulta" && (
          <div className="mt-4">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de agendamento
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFrequenciaConsulta("avulsa")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  frequenciaConsulta === "avulsa"
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                <CalendarClock className="h-4 w-4" />
                Avulsa
              </button>
              <button
                type="button"
                onClick={() => setFrequenciaConsulta("recorrente")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  frequenciaConsulta === "recorrente"
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                <Repeat className="h-4 w-4" />
                Recorrente
              </button>
            </div>
            {frequenciaConsulta === "recorrente" && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Frequência
                  <select
                    value={intervaloSemanas}
                    onChange={(e) => setIntervaloSemanas(Number(e.target.value) as 1 | 2)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value={1}>Semanal</option>
                    <option value={2}>Quinzenal</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Repetir até (opcional)
                  <input
                    type="date"
                    value={repetirAte}
                    onChange={(e) => setRepetirAte(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>
                <p className="col-span-2 text-xs text-zinc-400 dark:text-zinc-600">
                  Cria de imediato as próximas ocorrências (até 12). O que
                  vier depois disso é gerado conforme a data se aproxima.
                </p>
              </div>
            )}
          </div>
        )}

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

const weekdayFullLabels = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function TornarRecorrenteModal({
  item,
  onClose,
  onConfirm,
}: {
  item: Appointment;
  onClose: () => void;
  onConfirm: (input: { intervaloSemanas: 1 | 2; fim: string | null }) => Promise<void>;
}) {
  const [intervaloSemanas, setIntervaloSemanas] = useState<1 | 2>(1);
  const [repetirAte, setRepetirAte] = useState("");
  const [saving, setSaving] = useState(false);

  const [y, m, d] = item.date.split("-").map(Number);
  const diaSemana = weekdayFullLabels[new Date(y, m - 1, d).getDay()];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onConfirm({ intervaloSemanas, fim: repetirAte || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Tornar recorrente
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {item.patientName} passa a ter consulta toda {diaSemana} às {item.time}, a
          partir de {formatDateShort(item.date)}.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Frequência
            <select
              value={intervaloSemanas}
              onChange={(e) => setIntervaloSemanas(Number(e.target.value) as 1 | 2)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value={1}>Semanal</option>
              <option value={2}>Quinzenal</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Repetir até (opcional)
            <input
              type="date"
              value={repetirAte}
              onChange={(e) => setRepetirAte(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
          Cria de imediato as próximas ocorrências (até 12). Esta consulta continua
          exatamente como está — só passa a fazer parte da série.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Criando série..." : "Confirmar"}
        </button>
      </form>
    </div>
  );
}
