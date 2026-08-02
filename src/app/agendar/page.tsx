import Link from "next/link";
import { ArrowLeft, MapPin, ShieldAlert, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { FiltrosPsicologos, type FiltrosState } from "./filtros";

type PerfilPublicoResumo = {
  id: string;
  nome: string;
  titulo: string;
  crp: string;
  uf: string;
  cidade: string;
  foto_url: string | null;
  valor_consulta: number;
  especialidades: string[];
  abordagens: string[];
  faixas_etarias: string[];
};

export default async function AgendarDiretorioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const filtros: FiltrosState = {
    q: first(params.q),
    especialidade: first(params.especialidade),
    abordagem: first(params.abordagem),
    uf: first(params.uf),
    cidade: first(params.cidade),
    faixa: first(params.faixa),
  };

  const supabase = await createClient();

  let query = supabase
    .from("perfis_publico")
    .select(
      "id, nome, titulo, crp, uf, cidade, foto_url, valor_consulta, especialidades, abordagens, faixas_etarias"
    )
    .order("nome");

  if (filtros.q) query = query.ilike("nome", `%${filtros.q}%`);
  if (filtros.especialidade)
    query = query.contains("especialidades", [filtros.especialidade]);
  if (filtros.abordagem) query = query.contains("abordagens", [filtros.abordagem]);
  if (filtros.faixa) query = query.contains("faixas_etarias", [filtros.faixa]);
  if (filtros.uf) query = query.eq("uf", filtros.uf);
  if (filtros.cidade) query = query.ilike("cidade", `%${filtros.cidade}%`);

  const [{ data: psicologos }, { data: userData }] = await Promise.all([
    query.returns<PerfilPublicoResumo[]>(),
    supabase.auth.getUser(),
  ]);
  const voltarHref = userData.user ? "/agendamentos" : "/";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 font-sans dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <Link
          href={voltarHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="mt-4 flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-5 w-5 dark:invert" />
          Psi Rob
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Encontre um psicólogo
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Escolha um profissional para ver os horários disponíveis e agendar
          sua consulta.
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Para sua segurança, confira sempre se o CRP do profissional é
            válido antes de agendar — golpistas podem se passar por
            psicólogos.{" "}
            <a
              href="https://cadastro.cfp.org.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
            >
              Verificar CRP no site oficial do CFP
            </a>
          </p>
        </div>

        <FiltrosPsicologos initial={filtros} />

        {!psicologos || psicologos.length === 0 ? (
          <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum psicólogo encontrado para os filtros selecionados.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {psicologos.map((psicologo) => {
              const badges = [
                ...psicologo.abordagens,
                ...psicologo.especialidades,
              ].slice(0, 3);
              const regiao = [psicologo.cidade, psicologo.uf]
                .filter(Boolean)
                .join(" - ");

              return (
                <Link
                  key={psicologo.id}
                  href={`/agendar/${psicologo.id}`}
                  className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900"
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
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
                    </div>

                    {regiao && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {regiao}
                      </p>
                    )}

                    {badges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
