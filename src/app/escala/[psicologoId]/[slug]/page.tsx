import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getEscala } from "@/lib/escalas";
import { EscalaWizard } from "@/components/escalas/escala-wizard";

// Fora do índice: a URL pode carregar o token do convite (?c=), e uma escala
// respondida é dado clínico. Mesmo motivo da página de convite.
export const metadata: Metadata = {
  title: "Responder questionário",
  robots: { index: false, follow: false },
};

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
  const { data: perfis } = await supabase.rpc("perfis_publico", { p_ids: [psicologoId] });
  const perfil = (perfis as { id: string; nome: string }[] | null)?.[0] ?? null;

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
