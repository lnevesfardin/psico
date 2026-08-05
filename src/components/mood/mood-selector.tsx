"use client";

import type { MoodLevel } from "@/lib/mood-client";
import { MOOD_LABELS } from "@/lib/mood-client";

const MOOD_EMOJI: Record<MoodLevel, string> = {
  1: "😞",
  2: "🙁",
  3: "😐",
  4: "🙂",
  5: "😄",
};

const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export function MoodSelector({
  value,
  onChange,
}: {
  value: MoodLevel | null;
  onChange: (mood: MoodLevel) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {MOOD_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors ${
            value === level
              ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950"
              : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          }`}
        >
          <span className="text-2xl">{MOOD_EMOJI[level]}</span>
          <span className="text-[11px] font-medium leading-tight text-zinc-600 dark:text-zinc-400">
            {MOOD_LABELS[level]}
          </span>
        </button>
      ))}
    </div>
  );
}
