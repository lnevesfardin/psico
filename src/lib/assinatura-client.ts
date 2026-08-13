import type { SupabaseClient } from "@supabase/supabase-js";

// Duplicado do tipo em lib/stripe.ts de propósito: aquele arquivo importa o
// SDK do Stripe (server-only) — um Client Component importando só o tipo de
// lá arriscaria empacotar o SDK inteiro no bundle do navegador.
export type Plano = "mensal" | "anual";

export type Assinatura = {
  plano: Plano | null;
  status: string;
  trialFim: string | null;
  periodoAtualFim: string | null;
};

type AssinaturaRow = {
  plano: string | null;
  status: string;
  trial_fim: string | null;
  periodo_atual_fim: string | null;
};

export async function getAssinatura(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<Assinatura | null> {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("plano, status, trial_fim, periodo_atual_fim")
    .eq("psicologo_id", psicologoId)
    .maybeSingle<AssinaturaRow>();
  if (error || !data) return null;
  return {
    plano: data.plano as Plano | null,
    status: data.status,
    trialFim: data.trial_fim,
    periodoAtualFim: data.periodo_atual_fim,
  };
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
