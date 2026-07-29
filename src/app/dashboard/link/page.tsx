"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, Check, Link2, ExternalLink } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";

function noopSubscribe() {
  return () => {};
}

function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

export default function MeuLinkPage() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const link = `${origin}/agendar/${user?.id ?? ""}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meu Link de Agendamento
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Compartilhe este link para que pacientes agendem consultas com{" "}
        {profile.name} diretamente na sua agenda.
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
          <Link2 className="h-4 w-4" />
          Link público
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={link}
            className="w-full flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar link
              </>
            )}
          </button>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          Visualizar página pública
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Dica: adicione este link na bio do seu Instagram, WhatsApp Business ou
        assinatura de e-mail para facilitar o agendamento dos seus pacientes.
      </div>
    </div>
  );
}
