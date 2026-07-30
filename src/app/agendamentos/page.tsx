import { CalendarClock } from "lucide-react";

export default function AgendamentosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meus Agendamentos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Acompanhe aqui suas consultas marcadas.
      </p>

      <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <CalendarClock className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Seus agendamentos aparecerão aqui em breve.
        </p>
        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Use o link de agendamento do seu psicólogo para marcar uma
          consulta.
        </p>
      </div>
    </main>
  );
}
