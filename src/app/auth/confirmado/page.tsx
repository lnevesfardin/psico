import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "E-mail confirmado",
  description: "Sua conta foi confirmada e já está pronta para uso.",
  robots: { index: false, follow: false },
};

export default async function ConfirmadoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center font-sans dark:bg-zinc-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
        <CheckCircle2 className="h-9 w-9" />
      </div>
      <h1 className="mt-6 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Pronto! Você já pode voltar para o site.
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Seu e-mail foi confirmado com sucesso.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03] hover:bg-brand-700 active:scale-95"
      >
        Voltar para o site
      </Link>
    </div>
  );
}
