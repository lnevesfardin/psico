"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { brStates } from "@/lib/br-states";
import {
  especialidadesOptions,
  abordagensOptions,
  faixasEtariasOptions,
} from "@/lib/psico-options";

export type FiltrosState = {
  q: string;
  especialidade: string;
  abordagem: string;
  uf: string;
  cidade: string;
  faixa: string;
  precoMin: string;
  precoMax: string;
};

const emptyFiltros: FiltrosState = {
  q: "",
  especialidade: "",
  abordagem: "",
  uf: "",
  cidade: "",
  faixa: "",
  precoMin: "",
  precoMax: "",
};

function toQueryString(filtros: FiltrosState) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

const fieldClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

export function FiltrosPsicologos({ initial }: { initial: FiltrosState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState(initial);

  // Debounce: evita um push de navegação a cada tecla digitada (nome/cidade)
  // e agrupa mudanças rápidas de select num único push.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const query = toQueryString(form);
      router.push(query ? `${pathname}?${query}` : pathname);
    }, 350);
    return () => clearTimeout(timeout);
  }, [form, pathname, router]);

  function set<K extends keyof FiltrosState>(key: K, value: FiltrosState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const hasFilters = Object.values(form).some(Boolean);

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={form.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Buscar por nome..."
          className={`${fieldClass} pl-9`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <select
          value={form.especialidade}
          onChange={(e) => set("especialidade", e.target.value)}
          className={fieldClass}
        >
          <option value="">Especialidade</option>
          {especialidadesOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={form.abordagem}
          onChange={(e) => set("abordagem", e.target.value)}
          className={fieldClass}
        >
          <option value="">Abordagem</option>
          {abordagensOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={form.faixa}
          onChange={(e) => set("faixa", e.target.value)}
          className={fieldClass}
        >
          <option value="">Faixa etária</option>
          {faixasEtariasOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={form.uf}
          onChange={(e) => set("uf", e.target.value)}
          className={fieldClass}
        >
          <option value="">UF</option>
          {brStates.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={form.cidade}
          onChange={(e) => set("cidade", e.target.value)}
          placeholder="Cidade"
          className={fieldClass}
        />
      </div>

      <div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Faixa de preço (R$)
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={form.precoMin}
            onChange={(e) => set("precoMin", e.target.value)}
            placeholder="Mínimo"
            className={fieldClass}
          />
          <span className="text-sm text-zinc-400">até</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={form.precoMax}
            onChange={(e) => set("precoMax", e.target.value)}
            placeholder="Máximo"
            className={fieldClass}
          />
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => setForm(emptyFiltros)}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
