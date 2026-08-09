"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  TEXTOS_CONSENTIMENTO,
  aceitarConsentimento,
  consentimentosPendentes,
  listMeusConsentimentos,
  type Consentimento,
  type TipoConsentimento,
} from "@/lib/consentimentos-client";

export default function ConsentimentosPage() {
  const { user } = useAuth();
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [aceitando, setAceitando] = useState<TipoConsentimento | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listMeusConsentimentos(supabase)
      .then(setConsentimentos)
      .finally(() => setLoading(false));
  }, [user]);

  async function handleAceitar(tipo: TipoConsentimento) {
    setAceitando(tipo);
    setError(null);
    try {
      await aceitarConsentimento(tipo);
      const { versao } = TEXTOS_CONSENTIMENTO[tipo];
      setConsentimentos((prev) => [
        {
          id: `${tipo}-${Date.now()}`,
          tipo,
          versaoTexto: versao,
          aceito: true,
          aceitoEm: new Date().toISOString(),
          revogadoEm: null,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o aceite.");
    } finally {
      setAceitando(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      </main>
    );
  }

  const pendentes = consentimentosPendentes(consentimentos);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Termos e consentimentos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Termos que você aceitou (ou precisa aceitar) para usar a plataforma.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {(Object.keys(TEXTOS_CONSENTIMENTO) as TipoConsentimento[]).map((tipo) => {
          const info = TEXTOS_CONSENTIMENTO[tipo];
          const aceito = !pendentes.includes(tipo);
          return (
            <div
              key={tipo}
              className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-zinc-900 dark:text-white">{info.titulo}</h2>
                {aceito ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Aceito
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    Pendente
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {info.texto}
              </p>
              {!aceito && (
                <button
                  type="button"
                  onClick={() => handleAceitar(tipo)}
                  disabled={aceitando === tipo}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {aceitando === tipo ? "Registrando..." : "Li e aceito"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
