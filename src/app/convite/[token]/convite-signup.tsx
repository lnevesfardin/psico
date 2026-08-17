"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { aceitarConvite } from "@/lib/convites-client";
import { PasswordStrength } from "@/components/ui/password-strength";

function traduzErro(msg: string): string {
  if (msg.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (msg.includes("Password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}

export function ConviteSignup({
  token,
  primeiroNome,
}: {
  token: string;
  primeiroNome: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"cadastro" | "login">("cadastro");
  const [name, setName] = useState(primeiroNome);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function trocarModo(novo: "cadastro" | "login") {
    setMode(novo);
    setError(null);
  }

  // Só chamada com sessão já ativa: amarra a conta à ficha do paciente e
  // puxa o histórico de consultas anteriores (ver aceitar_convite_paciente).
  async function concluir(supabase: ReturnType<typeof createClient>) {
    try {
      await aceitarConvite(supabase, token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login feito, mas não foi possível vincular ao seu psicólogo."
      );
      setLoading(false);
      return;
    }
    router.push("/agendamentos");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // A conta do paciente nasce no servidor já com o e-mail confirmado (ver
    // /api/convite/criar-conta): quem tem o link do convite entra direto, sem
    // código de verificação. Por isso o cadastro não passa por supabase.auth
    // .signUp() aqui — ele obedeceria ao "Confirm email" global do projeto.
    const res = await fetch("/api/convite/criar-conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, telefone, email, password }),
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      if (payload?.code === "email-em-uso") {
        setMode("login");
        setError('Já existe uma conta com esse e-mail. Entre com a senha dela pra vincular ao seu psicólogo.');
      } else {
        setError(payload?.error ?? "Não foi possível criar a conta. Tente novamente.");
      }
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      setError("Conta criada, mas não foi possível entrar. Tente pelo login.");
      setLoading(false);
      return;
    }
    await concluir(supabase);
  }

  // Quem já é paciente (de outro psicólogo, ou desse mesmo antes) usa este
  // caminho em vez de cadastro: entra pela própria conta e o convite só
  // vincula a ficha, sem criar usuário novo.
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(traduzErro(error.message));
      setLoading(false);
      return;
    }
    await concluir(supabase);
  }

  if (mode === "login") {
    return (
      <div>
        <form onSubmit={handleLogin} className="space-y-4">
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
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Senha
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                required
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
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar e vincular
          </button>
        </form>

        <button
          type="button"
          onClick={() => trocarModo("cadastro")}
          className="mt-4 block w-full text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Não tenho conta — criar uma
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nome completo
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Telefone / WhatsApp
          <input
            type="tel"
            required
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

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

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Senha
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </label>

        <PasswordStrength value={password} showRules={password.length > 0} />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar minha conta
        </button>
      </form>

      <button
        type="button"
        onClick={() => trocarModo("login")}
        className="mt-4 block w-full text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Já tenho conta — entrar
      </button>
    </div>
  );
}
