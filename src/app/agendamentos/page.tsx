"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock, MapPin, Video } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  listClientAppointments,
  type ClientAppointment,
} from "@/lib/client-appointments-client";
import type { AppointmentStatus } from "@/lib/dashboard-data";
import { formatDateLabel } from "@/lib/format";

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

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    listClientAppointments(supabase, user.id)
      .then(setAppointments)
      .finally(() => setLoading(false));

    // Um agendamento feito agora mesmo (ou confirmado pelo psicólogo em
    // outro dispositivo) aparece aqui sem precisar recarregar a página.
    const channel = supabase
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
            Use o link de agendamento do seu psicólogo, ou busque um pela aba
            &quot;Buscar Psicólogo&quot;, para marcar uma consulta.
          </p>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="mt-6 space-y-3">
          {appointments.map((item) => (
            <Link
              key={item.id}
              href={`/agendar/${item.psicologoId}`}
              className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
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
          ))}
        </div>
      )}
    </main>
  );
}
