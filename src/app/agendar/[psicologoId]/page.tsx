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

  const [{ data: perfil }, { data: disponibilidades }] = await Promise.all([
    supabase
      .from("perfis_publico")
      .select(
        "id, nome, titulo, crp, uf, cidade, foto_url, bio, valor_consulta, especialidades, abordagens, faixas_etarias, tem_consultorio, consultorio_rua, consultorio_numero, consultorio_bairro, consultorio_cidade, consultorio_uf, consultorio_maps_url"
      )
      .eq("id", psicologoId)
      .single<PerfilPublico>(),
    supabase
      .from("disponibilidades_publico")
      .select("id, dia_semana, horario_inicio, horario_fim, modalidade")
      .eq("psicologo_id", psicologoId)
      .returns<DisponibilidadePublica[]>(),
  ]);

  if (!perfil) notFound();

  return (
    <BookingWizard
      psicologoId={psicologoId}
      perfil={perfil}
      disponibilidades={disponibilidades ?? []}
      modalidadeFixa={modalidadeFixa}
    />
  );
}
