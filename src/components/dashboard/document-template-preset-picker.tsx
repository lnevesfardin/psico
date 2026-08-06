"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { PRESET_TEMPLATES } from "@/lib/document-templates";

/** Agrupa os modelos prontos por categoria, na ordem em que aparecem na lista. */
function groupByTipo() {
  const groups = new Map<string, typeof PRESET_TEMPLATES>();
  for (const preset of PRESET_TEMPLATES) {
    const list = groups.get(preset.tipo) ?? [];
    list.push(preset);
    groups.set(preset.tipo, list);
  }
  return groups;
}

export function DocumentTemplatePresetPicker({
  existingNames,
  onClose,
  onPick,
}: {
  existingNames: string[];
  onClose: () => void;
  onPick: (preset: (typeof PRESET_TEMPLATES)[number]) => Promise<void>;
}) {
  const [addingNome, setAddingNome] = useState<string | null>(null);
  const groups = groupByTipo();

  async function handlePick(preset: (typeof PRESET_TEMPLATES)[number]) {
    setAddingNome(preset.nome);
    try {
      await onPick(preset);
    } finally {
      setAddingNome(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Modelos prontos
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Adicione um ponto de partida e customize depois.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {Array.from(groups.entries()).map(([tipo, presets]) => (
            <div key={tipo} className="mb-5 last:mb-0">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                {tipo}
              </h4>
              <div className="mt-2 space-y-1.5">
                {presets.map((preset) => {
                  const jaAdicionado = existingNames.includes(preset.nome);
                  return (
                    <div
                      key={preset.nome}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {preset.nome}
                      </span>
                      {jaAdicionado ? (
                        <span className="shrink-0 text-xs font-medium text-zinc-400 dark:text-zinc-600">
                          Já adicionado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePick(preset)}
                          disabled={addingNome === preset.nome}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-950/50 dark:text-brand-300 dark:hover:bg-brand-950"
                        >
                          <Plus className="h-3 w-3" />
                          {addingNome === preset.nome ? "Adicionando..." : "Adicionar"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
