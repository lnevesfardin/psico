"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, User, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, fetchUserRole, type Role } from "@/lib/auth/role";
import { brStates } from "@/lib/br-states";
import { StepIndicator } from "@/components/auth/step-indicator";
import { PasswordStrength } from "@/components/ui/password-strength";

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

// Mostrada quando o e-mail existe mas a senha não bate — cobre tanto "senha
// errada" quanto "essa conta nunca teve senha" (criada só via Google), sem
// diferenciar os dois casos (evitaria enumerar o provedor da conta).
const DICA_GOOGLE_OU_RECUPERAR =
  ' Se você criou sua conta pelo Google, use o botão "Continuar com o Google" abaixo ou redefina sua senha.';

function traduzErro(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email ou senha incorretos.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.";
  if (msg.includes("User already registered"))
    return `Já existe uma conta com esse email.${DICA_GOOGLE_OU_RECUPERAR}`;
  if (msg.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Token has expired or is invalid"))
    return "Código inválido ou expirado. Confira o número ou peça um novo código.";
  return msg;
}

// O Supabase Auth devolve o mesmo erro genérico ("Invalid login
// credentials") tanto pra "e-mail não cadastrado" quanto pra "senha
// errada" (incluindo contas que nunca tiveram senha, criadas só via
// Google) — de propósito, pra não deixar visitante descobrir quais
// e-mails têm conta só tentando logar. Só chamamos essa checagem extra
// (RPC que devolve um booleano, nada mais) nesse caso específico, pra
// guiar quem ainda não tem conta pro cadastro em vez de um "senha
// errada" confuso.
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
  return `Email ou senha incorretos.${DICA_GOOGLE_OU_RECUPERAR}`;
}

export function AuthForm({
  mode,
  initialError,
  initialRole,
}: {
  mode: Mode;
  initialError?: string;
  /** Pré-seleciona cliente/psicólogo quando o cadastro é aberto por um
   *  atalho que já sabe o papel (ex.: "Encontrar um psicólogo" na landing).
   *  A pessoa ainda pode trocar antes de enviar. */
  initialRole?: Role;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [name, setName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [crp, setCrp] = useState("");
  const [uf, setUf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

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
        data: {
          name,
          role,
          telefone,
          ...(role === "psychologist" ? { crp, uf } : {}),
        },
        // Rota própria (não /auth/callback) — só usada se o template de
        // e-mail do projeto ainda incluir o link de confirmação; o fluxo
        // principal agora é o código de 6 dígitos verificado abaixo, sem
        // sair desta tela.
        emailRedirectTo: `${window.location.origin}/auth/confirmado`,
      },
    });
    setLoading(false);
    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    if (data.session) {
      // E-mail já confirmado automaticamente (projeto Supabase sem
      // confirmação obrigatória): pula direto pro passo 3, sem passar
      // pela tela de código.
      router.push("/onboarding");
      router.refresh();
    } else {
      setAwaitingCode(true);
    }
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
    setLoading(false);
    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    if (!data.session || !data.user) return;
    // Passo 3: /onboarding resolve o papel sozinho e decide o que mostrar
    // (formulário completo pro psicólogo, confirmação simples pro cliente).
    router.push("/onboarding");
    router.refresh();
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

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(traduzErro(error.message));
  }

  if (awaitingCode) {
    return (
      <div>
        <StepIndicator current={2} />
        <h2 className="text-center text-lg font-semibold text-zinc-900 dark:text-white">
          Digite o código de verificação
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enviamos um código de 6 dígitos para <strong>{email}</strong>.
          Digite abaixo para ativar sua conta.
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
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
          {resending ? "Reenviando..." : resent ? "Código reenviado!" : "Reenviar código"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "cadastro" && <StepIndicator current={1} />}
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
            placeholder="Ex: Luiz Eduardo"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>
      )}

      {mode === "cadastro" && (
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
      )}

      {mode === "cadastro" && role === "psychologist" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Número do CRP
            <input
              type="text"
              required
              value={crp}
              onChange={(e) => setCrp(e.target.value)}
              placeholder="06/123456"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            UF
            <select
              required
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="" disabled>
                Selecione
              </option>
              {brStates.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
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

      {mode === "cadastro" && (
        <PasswordStrength value={password} showRules={password.length > 0} />
      )}

      {mode === "login" && (
        <Link
          href="/recuperar-senha"
          className="block text-right text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Esqueci minha senha
        </Link>
      )}

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
