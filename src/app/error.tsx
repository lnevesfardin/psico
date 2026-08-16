"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { reportarErro } from "@/lib/erros-client";

/**
 * Tela mostrada quando uma página quebra. Sem este arquivo o App Router cai
 * num erro genérico em inglês, e o problema não chega até você.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportarErro(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          Algo deu errado nesta tela
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          O problema foi registrado automaticamente. Seus dados não foram
          perdidos — tente de novo.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Voltar ao início
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-xs text-zinc-400 dark:text-zinc-600">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
