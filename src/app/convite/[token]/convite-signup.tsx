"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { aceitarConvite } from "@/lib/convites-client";
import { PasswordStrength } from "@/components/ui/password-strength";

function traduzErro(msg: string): string {
  if (msg.includes("User already registered"))
    return "Já existe uma conta com esse e-mail. Faça login e peça um novo convite ao seu psicólogo.";
  if (msg.includes("Password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Token has expired or is invalid"))
    return "Código inválido ou expirado. Confira o número ou peça um novo código.";
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
  const [name, setName] = useState(primeiroNome);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Só chamada com sessão já ativa: amarra a conta à ficha do paciente e
  // puxa o histórico de consultas anteriores (ver aceitar_convite_paciente).
  async function concluir(supabase: ReturnType<typeof createClient>) {
    try {
      await aceitarConvite(supabase, token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Conta criada, mas não foi possível vincular ao seu psicólogo."
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
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "paciente", telefone },
        emailRedirectTo: `${window.location.origin}/auth/confirmado`,
      },
    });

    if (error) {
      setError(traduzErro(error.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      await concluir(supabase);
      return;
    }
    setLoading(false);
    setAwaitingCode(true);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    if (error) {
      setError(traduzErro(error.message));
      setLoading(false);
      return;
    }
    if (!data.session) {
      setLoading(false);
      return;
    }
    await concluir(supabase);
  }

  async function handleResendCode() {
    setError(null);
    setResending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  if (awaitingCode) {
    return (
      <div>
        <h2 className="text-center text-base font-semibold text-zinc-900 dark:text-white">
          Digite o código de verificação
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enviamos um código de 6 dígitos para <strong>{email}</strong>.
        </p>

        <form onSubmit={handleVerifyCode} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Código de verificação
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-lg font-semibold tracking-[0.4em] text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verificar código
          </button>
        </form>

        <button
          type="button"
          onClick={handleResendCode}
          disabled={resending}
          className="mt-4 block w-full text-center text-sm font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-400"
        >
          {resending
            ? "Reenviando..."
            : resent
              ? "Código reenviado!"
              : "Reenviar código"}
        </button>
      </div>
    );
  }

  return (
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
  );
}
