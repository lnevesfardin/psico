"use client";

import { MOOD_TAGS, type MoodLevel, type MoodTag } from "@/lib/mood-client";

export function TagEnergyPicker({
  tags,
  onTagsChange,
  energy,
  onEnergyChange,
}: {
  tags: MoodTag[];
  onTagsChange: (tags: MoodTag[]) => void;
  energy: MoodLevel;
  onEnergyChange: (energy: MoodLevel) => void;
}) {
  function toggleTag(tag: MoodTag) {
    onTagsChange(
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          O que mais influenciou seu humor hoje?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOOD_TAGS.map(({ value, label, icone: Icone }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleTag(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                tags.includes(value)
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <Icone className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nível de energia
          </p>
          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
            {energy}/5
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={energy}
          onChange={(e) => onEnergyChange(Number(e.target.value) as MoodLevel)}
          className="mt-2 w-full accent-brand-600"
        />
      </div>
    </div>
  );
}
