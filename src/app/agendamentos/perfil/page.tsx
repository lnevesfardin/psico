"use client";

import { useState } from "react";
import { Check, IdCard, MessageCircle } from "lucide-react";
import { useClientProfile } from "@/context/client-profile-context";
import type { ClientProfile } from "@/lib/client-profile-data";
import { maskCpf, maskPhone } from "@/lib/format";

export default function ClientePerfilPage() {
  const { profile, updateProfile } = useClientProfile();
  const [draft, setDraft] = useState<ClientProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = draft ?? profile;

  function set<K extends keyof ClientProfile>(key: K, value: ClientProfile[K]) {
    setDraft({ ...form, [key]: value });
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateProfile(form);
      setDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meu Perfil
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Mantenha seus dados atualizados para facilitar o contato com seu
        psicólogo.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-6 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nome Completo
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="Seu nome completo"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="flex items-center gap-1.5">
            <IdCard className="h-4 w-4 text-zinc-400" />
            CPF
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={form.cpf}
            onChange={(e) => set("cpf", maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:max-w-xs"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Apresentação
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={4}
            placeholder="Conte um pouco sobre você..."
            className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-zinc-400" />
            WhatsApp / Contato
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            maxLength={15}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:max-w-xs"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </main>
  );
}
