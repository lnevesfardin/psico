"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/redefinir-senha`,
    });
    setLoading(false);
    // Mensagem de sucesso é a mesma independente de o e-mail existir ou não
    // (mesmo cuidado contra enumeração de contas já usado no login) — vale
    // também para contas criadas só via Google, que também podem passar a
    // ter senha a partir desse fluxo.
    if (error) {
      setError("Não foi possível enviar o link agora. Tente novamente em instantes.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>

        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                Verifique seu e-mail
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Se existir uma conta com o e-mail <strong>{email}</strong>,
                enviamos um link para você criar uma nova senha — inclusive
                se sua conta foi criada originalmente com o Google.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                Esqueci minha senha
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Informe seu e-mail. Enviaremos um link para você definir uma
                nova senha — funciona mesmo se sua conta foi criada com o
                botão &quot;Continuar com o Google&quot;.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                    {error}
                  </div>
                )}

                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link de redefinição
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
