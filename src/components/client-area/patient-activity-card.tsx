"use client";

import Link from "next/link";
import {
  Brain,
  Heart,
  ShieldCheck,
  Smile,
  Star,
  Users,
  Wind,
  Check,
  Clock,
  Play,
} from "lucide-react";
import {
  apresentacaoDa,
  ehNovidade,
  linkDaAtividade,
  type ActivityIconType,
  type ActivityThemeColor,
  type AtividadePaciente,
} from "@/lib/patient-activities";
import { formatDateShort } from "@/lib/format";

/** Classes completas por cor (ver comentário em patient-activities.ts). */
const BANNER: Record<ActivityThemeColor, string> = {
  roxo: "bg-violet-600",
  azul: "bg-sky-600",
  verde: "bg-teal-600",
  laranja: "bg-orange-500",
  rosa: "bg-pink-500",
  sobrio: "bg-slate-600",
};

const ICONES: Record<ActivityIconType, typeof Heart> = {
  heart: Heart,
  brain: Brain,
  smile: Smile,
  shield: ShieldCheck,
  star: Star,
  wind: Wind,
  users: Users,
};

export function PatientActivityCard({
  atividade,
}: {
  atividade: AtividadePaciente;
}) {
  const info = apresentacaoDa(atividade);
  if (!info) return null;

  const Icone = ICONES[info.iconType];
  const concluida = Boolean(atividade.respondidoEm);
  const nova = ehNovidade(atividade);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-zinc-800 dark:shadow-none dark:hover:border-white/20">
      <div className={`relative h-24 ${BANNER[info.themeColor]}`}>
        <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
          <Icone className="h-5 w-5" />
        </span>

        {(concluida || nova) && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-800">
            {concluida ? (
              <>
                <Check className="h-3 w-3" />
                RESPONDIDA
              </>
            ) : (
              "NOVA"
            )}
          </span>
        )}

        <span className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-xs font-medium text-white/90">
          <Clock className="h-3.5 w-3.5" />
          {info.estimatedTime}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          {info.title}
        </h3>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {info.instrumento} · enviada por {atividade.psicologoNome}
        </p>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {info.description}
        </p>

        {info.sensivel && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Se você estiver em risco agora, não espere a consulta: ligue{" "}
            <a href="tel:188" className="font-bold underline">
              188
            </a>{" "}
            (CVV, 24h) ou procure a emergência mais próxima.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {info.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/5 dark:text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {concluida ? (
          <p className="mt-4 rounded-full bg-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
            Respondida em {formatDateShort(atividade.respondidoEm!)}
          </p>
        ) : (
          <Link
            href={linkDaAtividade(atividade)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 active:scale-[0.98]"
          >
            <Play className="h-4 w-4" />
            Começar
          </Link>
        )}
      </div>
    </article>
  );
}
