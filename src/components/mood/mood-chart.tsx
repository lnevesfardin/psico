"use client";

import { useMemo, useState } from "react";
import type { MoodCheckin, MoodLevel } from "@/lib/mood-client";
import { MOOD_LABELS } from "@/lib/mood-client";
import { formatDateShort } from "@/lib/format";

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 24, left: 28 };
const MAX_POINTS = 60;

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000
  );
}

export function MoodChart({ checkins }: { checkins: MoodCheckin[] }) {
  const ascending = useMemo(
    () => [...checkins].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_POINTS),
    [checkins]
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (ascending.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Nenhum check-in registrado ainda.
      </p>
    );
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const first = ascending[0].date;
  const last = ascending[ascending.length - 1].date;
  const totalDays = Math.max(1, daysBetween(first, last));

  function x(date: string) {
    return PADDING.left + (daysBetween(first, date) / totalDays) * innerWidth;
  }
  function y(mood: MoodLevel) {
    return PADDING.top + innerHeight - ((mood - 1) / 4) * innerHeight;
  }

  // Quebra em segmentos: um dia sem check-in interrompe a linha em vez de
  // interpolar como se o humor tivesse continuado no vazio.
  const segments: MoodCheckin[][] = [];
  let current: MoodCheckin[] = [];
  for (const c of ascending) {
    if (current.length > 0 && daysBetween(current[current.length - 1].date, c.date) > 1) {
      segments.push(current);
      current = [];
    }
    current.push(c);
  }
  if (current.length > 0) segments.push(current);

  const hovered = hoverIndex !== null ? ascending[hoverIndex] : null;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    ascending.forEach((c, i) => {
      const dist = Math.abs(x(c.date) - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
            <g key={level}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y(level)}
                y2={y(level)}
                className="stroke-zinc-100 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 6}
                y={y(level)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-400 text-[9px] dark:fill-zinc-600"
              >
                {level}
              </text>
            </g>
          ))}

          {segments.map((seg, si) => (
            <polyline
              key={si}
              points={seg.map((c) => `${x(c.date)},${y(c.mood)}`).join(" ")}
              fill="none"
              className="stroke-brand-500 dark:stroke-brand-400"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {ascending.map((c, i) => (
            <circle
              key={c.id}
              cx={x(c.date)}
              cy={y(c.mood)}
              r={hoverIndex === i ? 5 : 3}
              className="fill-brand-600 dark:fill-brand-400"
            />
          ))}

          {hovered && (
            <line
              x1={x(hovered.date)}
              x2={x(hovered.date)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              className="stroke-zinc-300 dark:stroke-zinc-700"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <text x={PADDING.left} y={HEIGHT - 6} className="fill-zinc-400 text-[10px] dark:fill-zinc-600">
            {formatDateShort(first)}
          </text>
          <text
            x={WIDTH - PADDING.right}
            y={HEIGHT - 6}
            textAnchor="end"
            className="fill-zinc-400 text-[10px] dark:fill-zinc-600"
          >
            {formatDateShort(last)}
          </text>
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            style={{ left: `${(x(hovered.date) / WIDTH) * 100}%` }}
          >
            <p className="font-semibold text-zinc-900 dark:text-white">
              {formatDateShort(hovered.date)}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {MOOD_LABELS[hovered.mood]} · Energia {hovered.energy}/5
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
