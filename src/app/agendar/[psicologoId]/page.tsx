import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { ModalidadeAtendimento } from "@/lib/dashboard-data";
import {
  BookingWizard,
  type PerfilPublico,
  type DisponibilidadePublica,
} from "./booking-wizard";

/**
 * Título com o nome do profissional: é o que aparece na aba e na prévia
 * quando ele manda o link no WhatsApp. Usa só o que perfis_publico já expõe
 * na própria página — nada de paciente entra aqui.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ psicologoId: string }>;
}): Promise<Metadata> {
  const { psicologoId } = await params;
  const supabase = await createClient();
  const { data: perfis } = await supabase.rpc("perfis_publico", {
    p_ids: [psicologoId],
  });
  const perfil = (perfis as PerfilPublico[] | null)?.[0] ?? null;

  if (!perfil) return { title: "Agendar consulta" };

  return {
    title: `Agendar consulta com ${perfil.nome}`,
    description: `Veja os horários disponíveis e marque sua consulta com ${perfil.nome} pelo Psico.`,
    openGraph: {
      title: `Agendar consulta com ${perfil.nome}`,
      description: `Veja os horários disponíveis e marque sua consulta com ${perfil.nome}.`,
    },
  };
}

export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ psicologoId: string }>;
  searchParams: Promise<{ modalidade?: string }>;
}) {
  const { psicologoId } = await params;
  const { modalidade } = await searchParams;
  const modalidadeFixa: ModalidadeAtendimento | undefined =
    modalidade === "online" || modalidade === "presencial"
      ? modalidade
      : undefined;
  const supabase = await createClient();

  const [{ data: perfis }, { data: disponibilidades }] = await Promise.all([
    supabase.rpc("perfis_publico", { p_ids: [psicologoId] }),
    supabase.rpc("disponibilidades_publico", { p_psicologo_id: psicologoId }),
  ]);

  const perfil = (perfis as PerfilPublico[] | null)?.[0] ?? null;
  if (!perfil) notFound();

  return (
    <BookingWizard
      psicologoId={psicologoId}
      perfil={perfil}
      disponibilidades={(disponibilidades as DisponibilidadePublica[] | null) ?? []}
      modalidadeFixa={modalidadeFixa}
    />
  );
}
