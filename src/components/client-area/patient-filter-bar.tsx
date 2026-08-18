"use client";

import { Search } from "lucide-react";

export type GameTab = "para-voce" | "novidades" | "concluidos";

export const GAME_TABS: { value: GameTab; label: string }[] = [
  { value: "para-voce", label: "Para Você" },
  { value: "novidades", label: "Novidades" },
  { value: "concluidos", label: "Já Concluídos" },
];

export function PatientFilterBar({
  tab,
  onTabChange,
  busca,
  onBuscaChange,
  tema,
  onTemaChange,
  temas,
  contagem,
}: {
  tab: GameTab;
  onTabChange: (tab: GameTab) => void;
  busca: string;
  onBuscaChange: (busca: string) => void;
  tema: string;
  onTemaChange: (tema: string) => void;
  temas: string[];
  contagem: Record<GameTab, number>;
}) {
  return (
    <div className="mt-8">
      {/* overflow-x-auto: no celular as três abas não cabem lado a lado sem
          espremer o texto, e rolar é melhor do que quebrar linha. */}
      <div
        role="tablist"
        aria-label="Filtrar atividades"
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-white/10"
      >
        {GAME_TABS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            type="button"
            onClick={() => onTabChange(value)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === value
                ? "border-brand-500 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs font-normal text-zinc-400 dark:text-zinc-600">
              {contagem[value]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar atividade..."
            aria-label="Buscar atividade"
            className="w-full rounded-full border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <select
          value={tema}
          onChange={(e) => onTemaChange(e.target.value)}
          aria-label="Filtrar por tema"
          className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors focus:border-brand-500 focus:outline-none sm:w-52 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">Filtrar por tema</option>
          {temas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
