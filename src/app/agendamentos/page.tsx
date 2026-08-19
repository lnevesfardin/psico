"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock, MapPin, Video, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  cancelAppointment,
  listClientAppointments,
  type ClientAppointment,
} from "@/lib/client-appointments-client";
import type { AppointmentStatus } from "@/lib/dashboard-data";
import { formatDateLabel } from "@/lib/format";
import { encerrarInscricao, inscreverComSeguranca } from "@/lib/supabase/realtime-seguro";

const CANCELAVEIS: AppointmentStatus[] = ["pendente", "confirmada"];

const statusLabel: Record<AppointmentStatus, string> = {
  pendente: "Pendente de confirmação",
  confirmada: "Confirmada",
  realizada: "Realizada",
  desmarcada: "Desmarcada",
};

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

export default function AgendamentosPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<ClientAppointment | null>(
    null
  );

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    listClientAppointments(supabase, user.id)
      .then(setAppointments)
      .finally(() => setLoading(false));

    // Um agendamento feito agora mesmo (ou confirmado pelo psicólogo em
    // outro dispositivo) aparece aqui sem precisar recarregar a página.
    const channel = inscreverComSeguranca(() =>
      supabase
        .channel(`meus-agendamentos-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "consultas",
            filter: `cliente_id=eq.${user.id}`,
          },
          () => {
            listClientAppointments(supabase, user.id).then(setAppointments);
          }
        )
        .subscribe()
    );

    return () => encerrarInscricao(supabase, channel);
  }, [user]);

  function handleCancelled(id: string, motivo: string) {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "desmarcada", motivoCancelamento: motivo }
          : a
      )
    );
    setCancelTarget(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meus Agendamentos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Acompanhe aqui suas consultas marcadas.
      </p>

      {loading && (
        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Carregando...
        </p>
      )}

      {!loading && appointments.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <CalendarClock className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Seus agendamentos aparecerão aqui em breve.
          </p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Use o link de agendamento que seu psicólogo enviou para marcar uma
            consulta.
          </p>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="mt-6 space-y-3">
          {appointments.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link
                href={`/agendar/${item.psicologoId}`}
                className="flex items-center gap-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  {item.psicologoFotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.psicologoFotoUrl}
                      alt={item.psicologoNome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    item.psicologoNome
                      .split(" ")
                      .filter((w) => !["Dr.", "Dra."].includes(w))
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">
                    {item.psicologoNome}
                    {item.psicologoTitulo ? ` · ${item.psicologoTitulo}` : ""}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateLabel(item.date)} às {item.time}
                    {item.modalidade && (
                      <span className="ml-1 inline-flex items-center gap-1">
                        {item.modalidade === "presencial" ? (
                          <MapPin className="h-3.5 w-3.5" />
                        ) : (
                          <Video className="h-3.5 w-3.5" />
                        )}
                        {item.modalidade === "presencial" ? "Presencial" : "Online"}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[item.status]}`}
                >
                  {statusLabel[item.status]}
                </span>
              </Link>

              {item.status === "desmarcada" && item.motivoCancelamento && (
                <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                  Motivo do cancelamento: {item.motivoCancelamento}
                </p>
              )}

              {CANCELAVEIS.includes(item.status) && (
                <div className="mt-3 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCancelTarget(item)}
                    className="text-sm font-medium text-rose-600 transition-colors hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                  >
                    Cancelar agendamento
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <CancelModal
          appointment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      )}
    </main>
  );
}

function CancelModal({
  appointment,
  onClose,
  onCancelled,
}: {
  appointment: ClientAppointment;
  onClose: () => void;
  onCancelled: (id: string, motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const motivoTrim = motivo.trim();
    if (!motivoTrim) {
      setError("Conte pro psicólogo por que você precisa cancelar.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await cancelAppointment(supabase, appointment.id, motivoTrim);
      onCancelled(appointment.id, motivoTrim);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível cancelar."
      );
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
            Cancelar agendamento
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
          {formatDateLabel(appointment.date)} às {appointment.time} — o
          psicólogo será avisado do cancelamento e do motivo que você
          informar abaixo.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Motivo do cancelamento
          <textarea
            required
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: imprevisto de última hora, preciso remarcar para outro dia..."
            className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
