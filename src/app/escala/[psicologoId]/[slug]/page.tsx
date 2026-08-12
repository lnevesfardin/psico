import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEscala } from "@/lib/escalas";
import { EscalaWizard } from "@/components/escalas/escala-wizard";

export default async function ResponderEscalaPage({
  params,
  searchParams,
}: {
  params: Promise<{ psicologoId: string; slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { psicologoId, slug } = await params;
  // "c" (de convite) amarra a resposta à ficha do paciente. Não é lido aqui
  // além de repassar: quem valida o token é responder_escala_publico, para a
  // página pública nunca precisar consultar dado de paciente.
  const { c: token } = await searchParams;
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
      token={token}
    />
  );
}
