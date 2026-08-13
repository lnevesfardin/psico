import Stripe from "stripe";

export type Plano = "mensal" | "anual";

let cached: Stripe | null = null;

/**
 * Instancia sob demanda (não no import do módulo): sem isso, uma rota que
 * nunca é chamada em produção ainda quebraria o build/deploy se
 * STRIPE_SECRET_KEY não estiver configurada — mesmo padrão de
 * createAdminClient() em lib/supabase/admin.ts.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurada no ambiente do servidor.");
  }
  cached = new Stripe(key);
  return cached;
}

export function priceIdFor(plano: Plano): string {
  const id =
    plano === "mensal"
      ? process.env.STRIPE_PRICE_MENSAL
      : process.env.STRIPE_PRICE_ANUAL;
  if (!id) {
    throw new Error(
      `STRIPE_PRICE_${plano.toUpperCase()} não configurada no ambiente do servidor.`
    );
  }
  return id;
}

export const TRIAL_DIAS = 3;
