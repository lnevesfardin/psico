import { COMPLEXIDADE_LABELS, type Complexidade } from "@/lib/dashboard-data";

const CORES: Record<Complexidade, string> = {
  baixa:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  media: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  alta: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

/**
 * Selo de complexidade da ficha. Ficha sem classificação mostra o traço, e
 * não um selo vazio: "não classifiquei ainda" e "classifiquei como baixa"
 * são coisas diferentes.
 */
export function ComplexidadeBar({ nivel }: { nivel: Complexidade | null }) {
  if (!nivel) {
    return (
      <span className="text-xs text-zinc-300 dark:text-zinc-700">
        Não classificada
      </span>
    );
  }

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CORES[nivel]}`}
    >
      {COMPLEXIDADE_LABELS[nivel]}
    </span>
  );
}
