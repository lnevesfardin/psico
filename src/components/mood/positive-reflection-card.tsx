"use client";

import { Sparkles } from "lucide-react";

export function PositiveReflectionCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-950 dark:bg-emerald-950/40">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        <Sparkles className="h-4 w-4" />
        Que incrível!
      </div>
      <label className="mt-2 block text-sm text-emerald-900 dark:text-emerald-200">
        O que fez seu dia ser especial hoje?
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Opcional — escreva se quiser guardar esse momento."
          className="mt-1.5 w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-emerald-900 dark:bg-zinc-900 dark:text-white"
        />
      </label>
    </div>
  );
}
