"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // O link do e-mail já passou por /auth/callback e trocou o código por
    // uma sessão antes de chegar aqui — sem sessão, o link expirou ou já
    // foi usado.
    if (!authLoading && !user) {
      router.replace(
        "/login?error=" +
          encodeURIComponent("Link expirado ou inválido. Peça um novo.")
      );
    }
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(
        error.message.includes("Password should be at least")
          ? "A senha precisa ter pelo menos 6 caracteres."
          : "Não foi possível salvar a senha. Tente novamente."
      );
      return;
    }
    setDone(true);
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Quem clica no link de redefinição normalmente está numa aba nova (a do
  // e-mail), separada da aba onde tentou entrar antes — por isso, ao
  // terminar, mostramos uma confirmação em vez de já levar pro painel: essa
  // aba nova não é necessariamente onde a pessoa quer continuar navegando.
  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Senha alterada com sucesso
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Pode voltar para a aba onde você estava tentando entrar e fazer
              login com a nova senha.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            Defina uma nova senha
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            A partir de agora você também pode entrar com e-mail e senha,
            além do Google.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                {error}
              </div>
            )}

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nova senha
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar senha
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
