"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  abrirPortal,
  assinaturaEmDia,
  getAssinatura,
  iniciarCheckout,
  type Assinatura,
  type Plano,
} from "@/lib/assinatura-client";

const STATUS_LABEL: Record<string, { texto: string; tom: "ok" | "alerta" | "neutro" }> = {
  trialing: { texto: "Em teste grátis", tom: "ok" },
  active: { texto: "Ativa", tom: "ok" },
  past_due: { texto: "Pagamento pendente", tom: "alerta" },
  unpaid: { texto: "Pagamento não efetuado", tom: "alerta" },
  canceled: { texto: "Cancelada", tom: "neutro" },
  paused: { texto: "Pausada", tom: "neutro" },
  incomplete: { texto: "Não concluída", tom: "neutro" },
  incomplete_expired: { texto: "Expirada", tom: "neutro" },
};

const TOM_CLASSES = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  alerta: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  neutro: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PLANOS: { valor: Plano; nome: string; preco: string; nota: string }[] = [
  { valor: "mensal", nome: "Mensal", preco: "R$ 49/mês", nota: "Cobrado mês a mês." },
  {
    valor: "trimestral",
    nome: "Trimestral",
    preco: "R$ 45/mês",
    nota: "R$ 135 cobrado a cada 3 meses (8% mais barato).",
  },
  {
    valor: "anual",
    nome: "Anual",
    preco: "R$ 39/mês",
    nota: "R$ 468 cobrado uma vez por ano (20% mais barato).",
  },
];

function diasRestantes(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function SubscriptionCard({ psicologoId }: { psicologoId: string }) {
  const [assinatura, setAssinatura] = useState<Assinatura | null | undefined>(undefined);
  const [loadingPlano, setLoadingPlano] = useState<Plano | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssinatura(createClient(), psicologoId).then(setAssinatura);
  }, [psicologoId]);

  async function handleAssinar(plano: Plano) {
    setError(null);
    setLoadingPlano(plano);
    try {
      await iniciarCheckout(plano);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o checkout.");
      setLoadingPlano(null);
    }
  }

  async function handleGerenciar() {
    setError(null);
    setLoadingPortal(true);
    try {
      await abrirPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o portal.");
      setLoadingPortal(false);
    }
  }

  if (assinatura === undefined) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Mesma regra do banner e da RLS (assinatura_ativa) — inclusive "isento",
  // que a checagem daqui ignorava: conta de cortesia com status cancelado no
  // Stripe escreve normalmente no banco, mas este card oferecia plano como se
  // ela estivesse bloqueada.
  const emDia = assinaturaEmDia(assinatura);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <CreditCard className="h-4 w-4 text-zinc-400" />
        Plano e assinatura
      </span>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {assinatura && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">
            {/* "Plano Mensal" era o fallback de plano nulo, o que fazia uma
                conta de cortesia (sem plano nenhum) se anunciar como mensal. */}
            {assinatura.isento
              ? "Conta de cortesia"
              : assinatura.plano === "anual"
                ? "Plano Anual"
                : assinatura.plano === "trimestral"
                  ? "Plano Trimestral"
                  : assinatura.plano === "mensal"
                    ? "Plano Mensal"
                    : "Sem plano"}
          </span>
          {!assinatura.isento && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TOM_CLASSES[STATUS_LABEL[assinatura.status]?.tom ?? "neutro"]}`}
            >
              {STATUS_LABEL[assinatura.status]?.texto ?? assinatura.status}
            </span>
          )}
          {assinatura.isento && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TOM_CLASSES.ok}`}>
              Acesso liberado
            </span>
          )}
        </div>
      )}

      {assinatura?.status === "trialing" && assinatura.trialFim && (
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          {diasRestantes(assinatura.trialFim)} dia(s) de teste restante(s) — o cartão
          cadastrado é cobrado automaticamente depois disso.
        </p>
      )}

      {emDia ? (
        // Sem customer no Stripe não existe portal pra abrir — o botão só
        // levava a um erro. Conta de cortesia não tem o que gerenciar.
        assinatura?.temCobrancaStripe ? (
          <button
            type="button"
            onClick={handleGerenciar}
            disabled={loadingPortal}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loadingPortal && <Loader2 className="h-4 w-4 animate-spin" />}
            Gerenciar assinatura
          </button>
        ) : (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Seu acesso está liberado sem cobrança — não há assinatura pra
            gerenciar.
          </p>
        )
      ) : (
        <div className="mt-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            3 dias grátis pra testar, depois cobrança automática no cartão cadastrado.
            Cancele quando quiser pelo botão de gerenciar.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLANOS.map((p) => (
              <div
                key={p.valor}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {p.nome} — {p.preco}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{p.nota}</p>
                <button
                  type="button"
                  onClick={() => handleAssinar(p.valor)}
                  disabled={loadingPlano !== null}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingPlano === p.valor && <Loader2 className="h-4 w-4 animate-spin" />}
                  Começar teste grátis
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
