"use client";

import { useMemo, useState } from "react";
import { formatDateShort } from "@/lib/format";

const WIDTH = 640;
const HEIGHT = 240;
const PADDING = { top: 24, right: 16, bottom: 28, left: 32 };

export type SeriePonto = { date: string; escore: number; faixa: string };
export type Serie = {
  key: string;
  label: string;
  // Tailwind arbitrary-value classes — mesma convenção de dark: do resto do
  // app (ver mood-chart.tsx), em vez de CSS custom properties.
  strokeClass: string;
  fillClass: string;
};
export type Marcador = { date: string; label: string };

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000);
}

// Paleta categórica validada (skill dataviz, references/palette.md) — os 3
// primeiros slots (azul/laranja/água) são o único trio que valida todos os
// pares em claro e escuro, o caso exato das 3 subescalas do DASS-21.
export const SERIE_CORES: Record<string, Pick<Serie, "strokeClass" | "fillClass">> = {
  depressao: { strokeClass: "stroke-[#2a78d6] dark:stroke-[#3987e5]", fillClass: "fill-[#2a78d6] dark:fill-[#3987e5]" },
  ansiedade: { strokeClass: "stroke-[#eb6834] dark:stroke-[#d95926]", fillClass: "fill-[#eb6834] dark:fill-[#d95926]" },
  estresse: { strokeClass: "stroke-[#1baf7a] dark:stroke-[#199e70]", fillClass: "fill-[#1baf7a] dark:fill-[#199e70]" },
};

export function InstrumentoEvolucaoChart({
  series,
  pontosPorSerie,
  marcadores,
  escoreMax,
}: {
  series: Serie[];
  pontosPorSerie: Record<string, SeriePonto[]>;
  marcadores: Marcador[];
  escoreMax: number;
}) {
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const todasDatas = useMemo(
    () => Array.from(new Set(series.flatMap((s) => pontosPorSerie[s.key]?.map((p) => p.date) ?? []))).sort(),
    [series, pontosPorSerie]
  );

  if (todasDatas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Ainda não há respostas suficientes para mostrar a evolução.
      </p>
    );
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const first = todasDatas[0];
  const last = todasDatas[todasDatas.length - 1];
  const totalDays = Math.max(1, daysBetween(first, last));

  function x(date: string) {
    return PADDING.left + (daysBetween(first, date) / totalDays) * innerWidth;
  }
  function y(escore: number) {
    return PADDING.top + innerHeight - (Math.min(escore, escoreMax) / escoreMax) * innerHeight;
  }

  const marcadoresVisiveis = marcadores.filter((m) => m.date >= first && m.date <= last);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${s.fillClass}`} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
            let nearest = todasDatas[0];
            let nearestDist = Infinity;
            for (const d of todasDatas) {
              const dist = Math.abs(x(d) - relX);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = d;
              }
            }
            setHoverDate(nearest);
          }}
          onMouseLeave={() => setHoverDate(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <line
              key={frac}
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={PADDING.top + innerHeight * frac}
              y2={PADDING.top + innerHeight * frac}
              className="stroke-zinc-100 dark:stroke-zinc-800"
              strokeWidth={1}
            />
          ))}

          {marcadoresVisiveis.map((m) => (
            <g key={`${m.label}-${m.date}`}>
              <line
                x1={x(m.date)}
                x2={x(m.date)}
                y1={PADDING.top}
                y2={HEIGHT - PADDING.bottom}
                className="stroke-zinc-300 dark:stroke-zinc-700"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={x(m.date)}
                y={PADDING.top - 10}
                textAnchor="middle"
                className="fill-zinc-400 text-[9px] dark:fill-zinc-600"
              >
                {m.label}
              </text>
            </g>
          ))}

          {series.map((s) => {
            const pontos = (pontosPorSerie[s.key] ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
            return (
              <g key={s.key}>
                <polyline
                  points={pontos.map((p) => `${x(p.date)},${y(p.escore)}`).join(" ")}
                  fill="none"
                  className={s.strokeClass}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pontos.map((p) => (
                  <circle
                    key={p.date}
                    cx={x(p.date)}
                    cy={y(p.escore)}
                    r={hoverDate === p.date ? 5 : 3}
                    className={s.fillClass}
                  />
                ))}
              </g>
            );
          })}

          {hoverDate && (
            <line
              x1={x(hoverDate)}
              x2={x(hoverDate)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              className="stroke-zinc-300 dark:stroke-zinc-700"
              strokeWidth={1}
              strokeDasharray="2 2"
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

        {hoverDate && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            style={{ left: `${(x(hoverDate) / WIDTH) * 100}%` }}
          >
            <p className="font-semibold text-zinc-900 dark:text-white">{formatDateShort(hoverDate)}</p>
            {series.map((s) => {
              const ponto = pontosPorSerie[s.key]?.find((p) => p.date === hoverDate);
              if (!ponto) return null;
              return (
                <p key={s.key} className="text-zinc-500 dark:text-zinc-400">
                  {series.length > 1 ? `${s.label}: ` : ""}
                  {ponto.escore} · {ponto.faixa}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
