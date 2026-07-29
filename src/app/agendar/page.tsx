import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AgendarFallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center font-sans dark:bg-zinc-950">
      <Sparkles className="h-8 w-8 text-brand-600 dark:text-brand-400" />
      <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Link de agendamento inválido
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Peça ao seu psicólogo o link de agendamento dele, ou volte para a
        página inicial do Psi Rob.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Voltar ao site
      </Link>
    </div>
  );
}
