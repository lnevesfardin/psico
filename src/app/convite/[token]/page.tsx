import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchConviteInfo } from "@/lib/convites-client";
import { ConviteSignup } from "./convite-signup";

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const info = await fetchConviteInfo(supabase, token);

  if (!info || info.jaAceito) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
            Psi Rob
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              {info?.jaAceito ? "Convite já utilizado" : "Convite inválido"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {info?.jaAceito
                ? "Este convite já foi usado para criar uma conta. Se a conta é sua, é só entrar."
                : "Este link não é válido ou expirou. Peça um novo link para o seu psicólogo."}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
          Psi Rob
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            Olá, {info.pacientePrimeiroNome}!
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {info.psicologoNome} convidou você a criar sua conta para acompanhar
            seus agendamentos e registrar como você está se sentindo.
          </p>
          <div className="mt-6">
            <ConviteSignup
              token={token}
              primeiroNome={info.pacientePrimeiroNome}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
