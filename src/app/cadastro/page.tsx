import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Menu Inicial
        </Link>
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white"
        >
          <Sparkles className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          Psi Rob
        </Link>
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            Crie sua conta
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Psicólogos organizam agenda e pacientes; clientes acompanham seus
            agendamentos.
          </p>
          <div className="mt-6">
            <AuthForm mode="cadastro" initialError={error} />
          </div>
        </div>
      </div>
    </div>
  );
}
