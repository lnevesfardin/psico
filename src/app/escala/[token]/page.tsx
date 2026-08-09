import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchEscalaInfo } from "@/lib/instrumentos-client";
import { EscalaResponder } from "./escala-responder";

export default async function EscalaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const info = await fetchEscalaInfo(supabase, token);

  const invalido = !info || info.expirado || info.jaRespondido || info.instrumentoLicenca !== "livre";

  if (invalido) {
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
              {!info
                ? "Link inválido"
                : info.jaRespondido
                  ? "Escala já respondida"
                  : info.expirado
                    ? "Link expirado"
                    : "Link indisponível"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {!info
                ? "Este link não é válido. Confira com o seu psicólogo se o endereço está completo."
                : info.jaRespondido
                  ? "Esta escala já foi respondida e não pode ser respondida novamente."
                  : info.expirado
                    ? "O prazo para responder esta escala terminou. Peça um novo link ao seu psicólogo."
                    : "Este link não pode ser respondido por aqui. Fale com o seu psicólogo."}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
          Psi Rob
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            {info.instrumentoNome}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {info.instrumentoItens.instrucoes}
          </p>
          <div className="mt-6">
            <EscalaResponder
              token={token}
              sigla={info.instrumentoSigla}
              nome={info.instrumentoNome}
              itens={info.instrumentoItens}
              faixas={info.instrumentoFaixas}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
