import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getJogo } from "@/lib/jogos";
import { JogoPlayer } from "@/components/jogos/jogo-player";

// Fora do índice: a URL carrega o token do convite, e o que a pessoa
// responde aqui é material clínico. Mesmo motivo de /escala e /convite.
export const metadata: Metadata = {
  title: "Atividade",
  robots: { index: false, follow: false },
};

/**
 * O jogo é sempre aplicado pelo psicólogo a um paciente, então o token (?c=)
 * é obrigatório — sem ele não há a quem devolver a resposta. Diferente de
 * /escala, que também tem versão de link genérico.
 */
export default async function JogoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string; preview?: string }>;
}) {
  const { slug } = await params;
  const { c: token, preview } = await searchParams;

  const jogo = getJogo(slug);
  if (!jogo) notFound();

  // Visualização do psicólogo (abre do Espaço Interativo do painel): roda a
  // atividade inteira sem token e sem gravar nada.
  if (preview === "1") {
    return <JogoPlayer jogo={jogo} token="" preview />;
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-ink-950">
        <div className="w-full max-w-sm text-center">
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Link incompleto
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Esta atividade precisa do link completo que seu psicólogo enviou.
              Peça o link novamente para ele.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Ir para o início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <JogoPlayer jogo={jogo} token={token} />;
}
