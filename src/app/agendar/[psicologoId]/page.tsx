import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ModalidadeAtendimento } from "@/lib/dashboard-data";
import {
  BookingWizard,
  type PerfilPublico,
  type DisponibilidadePublica,
} from "./booking-wizard";

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
