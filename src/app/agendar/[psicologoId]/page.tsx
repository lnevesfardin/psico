import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingWizard, type PerfilPublico } from "./booking-wizard";

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ psicologoId: string }>;
}) {
  const { psicologoId } = await params;
  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("perfis_publico")
    .select(
      "id, nome, titulo, crp, uf, cidade, foto_url, bio, valor_consulta, especialidades, abordagens, faixas_etarias, dias_disponiveis, horario_inicio, horario_fim"
    )
    .eq("id", psicologoId)
    .single<PerfilPublico>();

  if (!perfil) notFound();

  return <BookingWizard psicologoId={psicologoId} perfil={perfil} />;
}
