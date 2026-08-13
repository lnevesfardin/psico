import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * Único caminho de escrita em "assinaturas" (ver schema.sql — sem policy de
 * insert/update pra "authenticated" de propósito). O Stripe chama esta rota
 * direto, sem cookie de sessão — quem autentica a requisição é a assinatura
 * HMAC no cabeçalho "stripe-signature", verificada com STRIPE_WEBHOOK_SECRET,
 * não um usuário logado.
 */
export async function POST(request: Request) {
  let stripe;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET não configurada no ambiente do servidor." },
      { status: 503 }
    );
  }
  try {
    stripe = getStripe();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuração ausente." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  // Corpo cru (não JSON já parseado): a verificação HMAC do Stripe precisa
  // dos bytes exatos que ele mandou, byte a byte igual ao que foi assinado.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: `Assinatura inválida: ${detail}` }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    // 500 (não 503): a assinatura do Stripe já foi validada, então isto é
    // erro de configuração nosso, não do chamador — e o Stripe reenvia
    // automaticamente em cima de qualquer erro 5xx.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuração ausente." },
      { status: 500 }
    );
  }

  async function salvarAssinatura(subscription: Stripe.Subscription) {
    const psicologoId = subscription.metadata?.psicologo_id;
    if (!psicologoId) {
      // Assinatura criada fora do fluxo desta rota (ex.: direto no painel
      // do Stripe, pra teste) — sem psicologo_id não tem em qual linha
      // gravar. Não é erro do webhook, só não é uma assinatura nossa.
      return;
    }
    const plano = subscription.metadata?.plano === "anual" ? "anual" : "mensal";
    const item = subscription.items.data[0];

    const { error } = await admin.from("assinaturas").upsert(
      {
        psicologo_id: psicologoId,
        stripe_customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        stripe_subscription_id: subscription.id,
        plano,
        status: subscription.status,
        trial_fim: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        periodo_atual_fim: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null,
      },
      { onConflict: "psicologo_id" }
    );
    // Propaga pro catch abaixo, que devolve 5xx — sem isso, uma falha de
    // gravação (ex.: schema.sql ainda não rodado) devolveria 200 "received"
    // mesmo assim, e o Stripe nunca reenviaria o evento pra tentar de novo.
    if (error) throw new Error(error.message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await salvarAssinatura(subscription);
        }
        break;
      }
      // Cobre trial terminando, virar active, past_due, cancelamento
      // agendado e cancelamento efetivo — o Stripe manda subscription.updated
      // (e subscription.deleted, com o mesmo formato de objeto) pra cada uma
      // dessas transições, sempre com o "status" já atualizado.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await salvarAssinatura(event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar o evento." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
