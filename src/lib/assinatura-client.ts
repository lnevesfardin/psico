import type { SupabaseClient } from "@supabase/supabase-js";

// Duplicado do tipo em lib/stripe.ts de propósito: aquele arquivo importa o
// SDK do Stripe (server-only) — um Client Component importando só o tipo de
// lá arriscaria empacotar o SDK inteiro no bundle do navegador.
export type Plano = "mensal" | "trimestral" | "anual";

export type Assinatura = {
  plano: Plano | null;
  status: string;
  trialFim: string | null;
  periodoAtualFim: string | null;
  isento: boolean;
  /** Só há portal do Stripe pra gerenciar se existir customer lá. Conta
   *  isenta (cortesia/grandfather) nunca teve customer — ver schema.sql. */
  temCobrancaStripe: boolean;
};

type AssinaturaRow = {
  plano: string | null;
  status: string;
  trial_fim: string | null;
  periodo_atual_fim: string | null;
  isento: boolean;
  stripe_customer_id: string | null;
};

export async function getAssinatura(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<Assinatura | null> {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("plano, status, trial_fim, periodo_atual_fim, isento, stripe_customer_id")
    .eq("psicologo_id", psicologoId)
    .maybeSingle<AssinaturaRow>();
  if (error || !data) return null;
  return {
    plano: data.plano as Plano | null,
    status: data.status,
    trialFim: data.trial_fim,
    periodoAtualFim: data.periodo_atual_fim,
    isento: data.isento ?? false,
    temCobrancaStripe: Boolean(data.stripe_customer_id),
  };
}

/**
 * Espelha exatamente a função assinatura_ativa() do schema.sql — a trava de
 * verdade é a RLS no banco; isto aqui é só pra UI conseguir avisar ANTES de
 * a pessoa preencher um formulário inteiro e tomar um erro seco de permissão.
 * Se as duas divergirem, quem manda é o banco.
 */
export function assinaturaEmDia(assinatura: Assinatura | null): boolean {
  if (!assinatura) return false;
  return (
    assinatura.isento ||
    assinatura.status === "trialing" ||
    assinatura.status === "active"
  );
}

async function postParaUrl(caminho: string, body?: unknown): Promise<string> {
  const res = await fetch(caminho, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Não foi possível completar a operação.");
  }
  return data.url;
}

/** Redireciona para o Checkout do Stripe — sai desta aba de propósito. */
export async function iniciarCheckout(plano: Plano): Promise<void> {
  const url = await postParaUrl("/api/stripe/checkout", { plano });
  window.location.href = url;
}

/** Redireciona para o portal do cliente (Stripe) — gerenciar/cancelar. */
export async function abrirPortal(): Promise<void> {
  const url = await postParaUrl("/api/stripe/portal");
  window.location.href = url;
}
