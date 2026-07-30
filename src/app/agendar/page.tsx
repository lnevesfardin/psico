import Link from "next/link";
import { Sparkles, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";

type PerfilPublicoResumo = {
  id: string;
  nome: string;
  titulo: string;
  crp: string;
  foto_url: string | null;
  valor_consulta: number;
};

export default async function AgendarDiretorioPage() {
  const supabase = await createClient();
  const { data: psicologos } = await supabase
    .from("perfis_publico")
    .select("id, nome, titulo, crp, foto_url, valor_consulta")
    .order("nome")
    .returns<PerfilPublicoResumo[]>();

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 font-sans dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          Psi Rob
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Encontre um psicólogo
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Escolha um profissional para ver os horários disponíveis e agendar
          sua consulta.
        </p>

        {!psicologos || psicologos.length === 0 ? (
          <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum psicólogo disponível para agendamento no momento.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {psicologos.map((psicologo) => (
              <Link
                key={psicologo.id}
                href={`/agendar/${psicologo.id}`}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  {psicologo.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={psicologo.foto_url}
                      alt={psicologo.nome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                    {psicologo.nome}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {psicologo.titulo} · {psicologo.crp}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400">
                  {formatCurrency(psicologo.valor_consulta)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
