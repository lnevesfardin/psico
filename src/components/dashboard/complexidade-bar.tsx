import { COMPLEXIDADE_LABELS, type Complexidade } from "@/lib/dashboard-data";

/** Quantas barras acesas em cada nível, de 10. */
const PREENCHIDAS: Record<Complexidade, number> = { baixa: 3, media: 6, alta: 10 };

const COR: Record<Complexidade, string> = {
  baixa: "bg-emerald-500",
  media: "bg-amber-500",
  alta: "bg-rose-500",
};

const COR_TEXTO: Record<Complexidade, string> = {
  baixa: "text-emerald-600 dark:text-emerald-400",
  media: "text-amber-600 dark:text-amber-400",
  alta: "text-rose-600 dark:text-rose-400",
};

/**
 * Medidor de complexidade da ficha. Ficha sem classificação mostra o traço,
 * e não barras zeradas: "não classifiquei ainda" e "classifiquei como baixa"
 * são coisas diferentes, e a barra vazia confundiria as duas.
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
    <span className="flex items-center gap-2" title={`Complexidade ${COMPLEXIDADE_LABELS[nivel]}`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-[3px] rounded-sm ${
              i < PREENCHIDAS[nivel] ? COR[nivel] : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </span>
      <span className={`text-xs font-semibold ${COR_TEXTO[nivel]}`}>
        {COMPLEXIDADE_LABELS[nivel]}
      </span>
    </span>
  );
}
