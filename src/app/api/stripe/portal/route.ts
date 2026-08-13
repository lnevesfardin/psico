import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * Abre o portal do cliente (Stripe) — página hospedada pelo próprio Stripe
 * onde o psicólogo troca cartão, vê faturas e cancela a assinatura sozinho,
 * sem precisar de nenhuma tela própria aqui pra isso.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuração ausente." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("stripe_customer_id")
    .eq("psicologo_id", user.id)
    .maybeSingle<{ stripe_customer_id: string }>();

  if (!assinatura) {
    return NextResponse.json(
      { error: "Você ainda não tem uma assinatura." },
      { status: 404 }
    );
  }

  const origin = new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: assinatura.stripe_customer_id,
    return_url: `${origin}/dashboard/perfil`,
  });

  return NextResponse.json({ url: session.url });
}
