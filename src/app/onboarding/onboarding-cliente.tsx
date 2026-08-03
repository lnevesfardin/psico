"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, User, MessageCircle } from "lucide-react";
import {
  ClientProfileProvider,
  useClientProfile,
} from "@/context/client-profile-context";
import { StepIndicator } from "@/components/auth/step-indicator";

// Cliente não preenche nada além do que já deu no cadastro (nome/WhatsApp,
// ver auth-form.tsx): o passo 3 aqui é só uma confirmação, sem novos campos
// nem coluna nova no banco — diferente do onboarding do psicólogo, que ainda
// precisa de CRP, especialidades e disponibilidade antes de atender.
export function OnboardingCliente() {
  return (
    <ClientProfileProvider>
      <OnboardingClienteContent />
    </ClientProfileProvider>
  );
}

function OnboardingClienteContent() {
  const router = useRouter();
  const { profile, loading } = useClientProfile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const primeiroNome = profile.name.trim().split(" ")[0] || "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
          Psi Rob
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <StepIndicator current={3} />

          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              {primeiroNome ? `Cadastro concluído, ${primeiroNome}!` : "Cadastro concluído!"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Sua conta está pronta. Confira seus dados antes de continuar.
            </p>
          </div>

          <div className="mt-6 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="flex items-center gap-2.5 text-sm">
              <User className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="text-zinc-700 dark:text-zinc-300">
                {profile.name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <MessageCircle className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="text-zinc-700 dark:text-zinc-300">
                {profile.whatsapp || "—"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/agendamentos")}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Ir para agendamentos
          </button>
        </div>
      </div>
    </div>
  );
}
