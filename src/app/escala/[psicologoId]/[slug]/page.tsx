import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEscala } from "@/lib/escalas";
import { EscalaWizard } from "@/components/escalas/escala-wizard";

export default async function ResponderEscalaPage({
  params,
}: {
  params: Promise<{ psicologoId: string; slug: string }>;
}) {
  const { psicologoId, slug } = await params;
  const escala = getEscala(slug);
  if (!escala) notFound();

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_publico")
    .select("id, nome")
    .eq("id", psicologoId)
    .single<{ id: string; nome: string }>();

  if (!perfil) notFound();

  return (
    <EscalaWizard
      psicologoId={psicologoId}
      psicologoNome={perfil.nome}
      escala={escala}
    />
  );
}
