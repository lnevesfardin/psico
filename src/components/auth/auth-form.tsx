"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, User, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, fetchUserRole, type Role } from "@/lib/auth/role";

type Mode = "login" | "cadastro";

const roleOptions: { value: Role; label: string; icon: typeof User }[] = [
  { value: "client", label: "Sou Cliente", icon: User },
  { value: "psychologist", label: "Sou Psicólogo", icon: Stethoscope },
];

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function traduzErro(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email ou senha incorretos.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.";
  if (msg.includes("User already registered")) return "Já existe uma conta com esse email.";
  if (msg.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}

// O Supabase Auth devolve o mesmo erro genérico ("Invalid login
// credentials") tanto pra "e-mail não cadastrado" quanto pra "senha
// errada" — de propósito, pra não deixar visitante descobrir quais e-mails
// têm conta só tentando logar. Só chamamos essa checagem extra (RPC que
// devolve um booleano, nada mais) nesse caso específico, pra guiar quem
// ainda não tem conta pro cadastro em vez de um "senha errada" confuso.
async function resolveLoginError(
  supabase: ReturnType<typeof createClient>,
  message: string,
  email: string
): Promise<string> {
  if (!message.includes("Invalid login credentials")) {
    return traduzErro(message);
  }
  const { data: existe } = await supabase.rpc("email_existe", { p_email: email });
  if (existe === false) {
    return "Não encontramos uma conta com esse e-mail. Crie uma conta gratuita primeiro.";
  }
  return "Email ou senha incorretos.";
}

export function AuthForm({
  mode,
  initialError,
}: {
  mode: Mode;
  initialError?: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(await resolveLoginError(supabase, error.message, email));
        setLoading(false);
        return;
      }
      const role = await fetchUserRole(supabase, data.user.id);
      setLoading(false);
      router.push(dashboardPathForRole(role));
      router.refresh();
      return;
    }

    if (!role) {
      setLoading(false);
      setError("Escolha se você é cliente ou psicólogo.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
        // Rota própria (não /auth/callback) — clicar no link do e-mail só
        // confirma a conta e mostra uma mensagem simples, sem redirecionar
        // direto pro painel. O login por Google continua indo por
        // /auth/callback normalmente (não passa por confirmação de e-mail).
        emailRedirectTo: `${window.location.origin}/auth/confirmado`,
      },
    });
    setLoading(false);
    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    if (data.session) {
      router.push(dashboardPathForRole(role));
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(traduzErro(error.message));
  }

  if (checkEmail) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Verifique seu e-mail
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Enviamos um link de confirmação para <strong>{email}</strong>. Clique
          nele para ativar sua conta e fazer login.
        </p>
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

      {mode === "cadastro" && (
        <div>
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Como você vai usar o Psi Rob?
          </span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {roleOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${
                  role === value
                    ? "border-brand-600 bg-brand-50 dark:bg-brand-950/40"
                    : "border-zinc-200 bg-white hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-800"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    role === value
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-zinc-400"
                  }`}
                />
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "cadastro" && (
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nome completo
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Luiz Eduardo"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>
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
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={loading || (mode === "cadastro" && !role)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "login" ? "Entrar" : "Criar conta"}
      </button>

      <div className="relative py-1 text-center text-xs text-zinc-400">
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-zinc-200 dark:border-zinc-800" />
        <span className="bg-white px-2 dark:bg-zinc-900">ou</span>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        <GoogleIcon />
        Continuar com o Google
      </button>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        {mode === "login" ? (
          <>
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Criar nova conta
            </Link>
          </>
        ) : (
          <>
            Já tenho conta?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Fazer Login
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
