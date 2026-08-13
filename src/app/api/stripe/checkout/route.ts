import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, priceIdFor, TRIAL_DIAS, type Plano } from "@/lib/stripe";

function isPlano(value: unknown): value is Plano {
  return value === "mensal" || value === "anual";
}

/**
 * Cria a sessão de Checkout (Stripe) pra assinar um plano. Reaproveita o
 * customer do Stripe se o psicólogo já tiver um (de uma assinatura
 * cancelada, por exemplo) — evita duplicar cliente no painel do Stripe a
 * cada nova tentativa.
 */
export async function POST(request: Request) {
  let plano: unknown;
  try {
    ({ plano } = (await request.json()) as { plano?: unknown });
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (!isPlano(plano)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let stripe;
  let priceId;
  try {
    stripe = getStripe();
    priceId = priceIdFor(plano);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuração ausente." },
      { status: 503 }
    );
  }

  // service role: ler/gravar customer_id em "assinaturas" não depende de
  // policy nenhuma pro psicólogo (a tabela não tem insert/update pra
  // "authenticated" de propósito, ver schema.sql).
  const admin = createAdminClient();
  const { data: existente } = await admin
    .from("assinaturas")
    .select("stripe_customer_id")
    .eq("psicologo_id", user.id)
    .maybeSingle<{ stripe_customer_id: string }>();

  let customerId = existente?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { psicologo_id: user.id },
    });
    customerId = customer.id;
  }

  const origin = new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // payment_method_collection não é definido de propósito: o padrão do
    // Stripe em modo assinatura é "always", que coleta o cartão mesmo com
    // trial e cobra sozinho assim que ele termina — é exatamente o
    // comportamento pedido (trial de 3 dias, cartão obrigatório já na hora).
    subscription_data: {
      trial_period_days: TRIAL_DIAS,
      metadata: { psicologo_id: user.id, plano },
    },
    metadata: { psicologo_id: user.id, plano },
    success_url: `${origin}/dashboard/perfil?assinatura=sucesso`,
    cancel_url: `${origin}/dashboard/perfil?assinatura=cancelado`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Não foi possível iniciar o checkout." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: session.url });
}
