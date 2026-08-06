import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, ExternalLink, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatEndereco } from "@/lib/format";
import { ProfileCard } from "@/components/ui/profile-card";
import type { PerfilPublico } from "../booking-wizard";

export default async function PerfilPsicologoPage({
  params,
}: {
  params: Promise<{ psicologoId: string }>;
}) {
  const { psicologoId } = await params;
  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("perfis_publico")
    .select(
      "id, nome, titulo, crp, uf, cidade, foto_url, bio, valor_consulta, especialidades, abordagens, faixas_etarias, tem_consultorio, consultorio_rua, consultorio_numero, consultorio_bairro, consultorio_cidade, consultorio_uf, consultorio_maps_url"
    )
    .eq("id", psicologoId)
    .single<PerfilPublico>();

  if (!perfil) notFound();

  const regiao = [perfil.cidade, perfil.uf].filter(Boolean).join(" - ");

  return (
    <div className="min-h-screen bg-zinc-50 py-8 dark:bg-zinc-950 sm:py-14">
      <div className="mx-auto mb-6 w-full max-w-5xl px-4">
        <Link
          href="/agendar"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a busca
        </Link>
      </div>

      <ProfileCard
        name={perfil.nome}
        title={[perfil.titulo, perfil.crp].filter(Boolean).join(" · ")}
        description={perfil.bio ?? undefined}
        imageUrl={perfil.foto_url ?? undefined}
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {regiao && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {regiao}
              </span>
            )}
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              {formatCurrency(perfil.valor_consulta)} / sessão
            </span>
          </div>
        }
        badgeGroups={[
          { label: "Faixa etária atendida", items: perfil.faixas_etarias },
          { label: "Abordagem clínica", items: perfil.abordagens },
          {
            label: "Especialidades / Demandas atendidas",
            items: perfil.especialidades,
          },
        ]}
        footer={
          <div className="space-y-4">
            {perfil.tem_consultorio && perfil.consultorio_rua && (
              <div className="rounded-2xl bg-gray-100 p-4 dark:bg-white/5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Consultório
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                  {formatEndereco({
                    rua: perfil.consultorio_rua,
                    numero: perfil.consultorio_numero,
                    bairro: perfil.consultorio_bairro,
                    cidade: perfil.consultorio_cidade,
                    uf: perfil.consultorio_uf,
                  })}
                </p>
                {perfil.consultorio_maps_url && (
                  <a
                    href={perfil.consultorio_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Ver no Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
            <Link
              href={`/agendar/${perfil.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <CalendarCheck className="h-4 w-4" />
              Agendar consulta
            </Link>
          </div>
        }
      />
    </div>
  );
}
