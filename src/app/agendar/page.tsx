import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FiltrosPsicologos, type FiltrosState } from "./filtros";
import { PsicologoCard, type PsicologoResumo } from "./psicologo-card";

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
    precoMin: first(params.precoMin),
    precoMax: first(params.precoMax),
  };
  const precoMin = Number(filtros.precoMin);
  const precoMax = Number(filtros.precoMax);

  const supabase = await createClient();

  let query = supabase
    .from("perfis_publico")
    .select(
      "id, nome, titulo, crp, uf, cidade, foto_url, bio, valor_consulta, especialidades, abordagens, faixas_etarias, tem_consultorio, consultorio_rua, consultorio_numero, consultorio_bairro, consultorio_cidade, consultorio_uf, consultorio_maps_url"
    )
    .order("nome");

  if (filtros.q) query = query.ilike("nome", `%${filtros.q}%`);
  if (filtros.especialidade)
    query = query.contains("especialidades", [filtros.especialidade]);
  if (filtros.abordagem) query = query.contains("abordagens", [filtros.abordagem]);
  if (filtros.faixa) query = query.contains("faixas_etarias", [filtros.faixa]);
  if (filtros.uf) query = query.eq("uf", filtros.uf);
  if (filtros.cidade) query = query.ilike("cidade", `%${filtros.cidade}%`);
  if (filtros.precoMin && Number.isFinite(precoMin))
    query = query.gte("valor_consulta", precoMin);
  if (filtros.precoMax && Number.isFinite(precoMax))
    query = query.lte("valor_consulta", precoMax);

  const [{ data: psicologos }, { data: userData }] = await Promise.all([
    query.returns<PsicologoResumo[]>(),
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
            {psicologos.map((psicologo) => (
              <PsicologoCard key={psicologo.id} psicologo={psicologo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
