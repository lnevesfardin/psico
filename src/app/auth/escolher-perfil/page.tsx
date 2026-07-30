"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Stethoscope, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, fetchUserRole, type Role } from "@/lib/auth/role";

const roleOptions: {
  value: Role;
  label: string;
  description: string;
  icon: typeof User;
}[] = [
  {
    value: "client",
    label: "Sou Cliente",
    description: "Quero agendar e acompanhar minhas consultas.",
    icon: User,
  },
  {
    value: "psychologist",
    label: "Sou Psicólogo",
    description: "Quero gerenciar minha agenda e pacientes.",
    icon: Stethoscope,
  },
];

export default function EscolherPerfilPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const supabase = createClient();
    // Se a pessoa já escolheu antes (ou voltou nessa página depois de já
    // ter escolhido), não deixa escolher de novo — o banco bloquearia a
    // troca de qualquer forma (block_role_change), então manda direto pro
    // painel certo em vez de mostrar um erro.
    fetchUserRole(supabase, user.id).then((role) => {
      if (role) {
        router.replace(dashboardPathForRole(role));
        return;
      }
      setChecking(false);
    });
  }, [authLoading, user, router]);

  async function handleChoose(role: Role) {
    if (!user || saving) return;
    setSaving(role);
    setError(null);
    const supabase = createClient();

    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      "";

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role, ...(displayName ? { name: displayName } : {}) })
      .eq("id", user.id);

    if (updateError) {
      setError("Não foi possível salvar. Tente novamente.");
      setSaving(null);
      return;
    }

    if (role === "psychologist") {
      await supabase
        .from("perfis")
        .upsert({ id: user.id, ...(displayName ? { nome: displayName } : {}) });
    }

    router.push(dashboardPathForRole(role));
    router.refresh();
  }

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
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
            Como você vai usar o Psi Rob?
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Escolha um perfil para continuar. Essa escolha não pode ser
            alterada depois.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            {roleOptions.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleChoose(value)}
                disabled={saving !== null}
                className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center transition-colors hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {saving === value ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                ) : (
                  <Icon className="h-5 w-5 text-zinc-400" />
                )}
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {label}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
