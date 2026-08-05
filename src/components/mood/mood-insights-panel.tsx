"use client";

import { Lightbulb } from "lucide-react";
import type { MoodCheckin } from "@/lib/mood-client";
import { buildInsights, checkinsNeededForInsights } from "@/lib/mood-insights";

export function MoodInsightsPanel({ checkins }: { checkins: MoodCheckin[] }) {
  const insights = buildInsights(checkins);
  const missing = checkinsNeededForInsights(checkins);

  if (missing > 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Continue registrando seu humor — faltam {missing} check-in
        {missing === 1 ? "" : "s"} para começarmos a mostrar padrões.
      </p>
    );
  }

  if (insights.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Ainda não identificamos um padrão claro nos seus registros.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-xl border border-zinc-100 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{insight.text}</p>
        </div>
      ))}
    </div>
  );
}
