"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { aceitarConvite } from "@/lib/convites-client";

/** Mostrado quando quem abre o link já está logado com uma conta de
 *  cliente (ex.: já é paciente de outro psicólogo no Psico) — evita forçar
 *  um segundo cadastro pra um e-mail que já existe. */
export function ConviteVincular({
  token,
  psicologoNome,
}: {
  token: string;
  psicologoNome: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVincular() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      await aceitarConvite(supabase, token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível vincular o convite à sua conta."
      );
      setLoading(false);
      return;
    }
    router.push("/agendamentos");
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Você já tem uma conta no Psico com este e-mail. Confirme abaixo para
        vincular {psicologoNome} à sua conta — sem precisar cadastrar de novo.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleVincular}
        disabled={loading}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Vincular à minha conta
      </button>
    </div>
  );
}
