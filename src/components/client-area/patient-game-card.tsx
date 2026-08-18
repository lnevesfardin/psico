"use client";

import { Brain, Heart, Smile, Star, Check, Clock, Play } from "lucide-react";
import type {
  GameIconType,
  GameThemeColor,
  PatientGame,
} from "@/lib/patient-games";

/**
 * Classes completas por cor: o Tailwind lê o código-fonte para gerar o CSS,
 * então classe montada por concatenação (`bg-${cor}-500`) não existiria no
 * arquivo final e o banner sairia sem cor.
 */
const BANNER: Record<GameThemeColor, string> = {
  roxo: "bg-violet-600",
  azul: "bg-sky-600",
  verde: "bg-teal-600",
  laranja: "bg-orange-500",
  rosa: "bg-pink-500",
};

const ICONES: Record<GameIconType, typeof Heart> = {
  heart: Heart,
  brain: Brain,
  smile: Smile,
  star: Star,
};

/** Só um selo por cartão, na ordem em que importam para o paciente. */
function selo(game: PatientGame): string | null {
  if (game.status === "completed") return "CONCLUÍDO";
  if (game.status === "in_progress") return "CONTINUAR";
  if (game.isRecommended) return "RECOMENDADO";
  if (game.status === "new") return "NOVO";
  return null;
}

function rotuloBotao(status: PatientGame["status"]): string {
  if (status === "in_progress") return "Continuar";
  if (status === "completed") return "Fazer de novo";
  return "Começar";
}

export function PatientGameCard({
  game,
  onStart,
}: {
  game: PatientGame;
  onStart: (game: PatientGame) => void;
}) {
  const Icone = ICONES[game.iconType];
  const badge = selo(game);
  const concluido = game.status === "completed";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-zinc-800 dark:shadow-none dark:hover:border-white/20">
      <div className={`relative h-24 ${BANNER[game.themeColor]}`}>
        <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
          <Icone className="h-5 w-5" />
        </span>

        {badge && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-800">
            {concluido && <Check className="h-3 w-3" />}
            {badge}
          </span>
        )}

        <span className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-xs font-medium text-white/90">
          <Clock className="h-3.5 w-3.5" />
          {game.estimatedTime}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          {game.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {game.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {game.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/5 dark:text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onStart(game)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 active:scale-[0.98]"
        >
          <Play className="h-4 w-4" />
          {rotuloBotao(game.status)}
        </button>
      </div>
    </article>
  );
}
