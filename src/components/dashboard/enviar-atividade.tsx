"use client";

import { useState } from "react";
import {
  Brain,
  Check,
  Clock,
  Copy,
  Heart,
  Loader2,
  Send,
  ShieldAlert,
  Smile,
  Star,
  Users,
  Wind,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { ESCALAS_DISPONIVEIS, type EscalaSlug } from "@/lib/escalas";
import { gerarConviteEscala } from "@/lib/respostas-escala-client";
import {
  APRESENTACAO,
  type ActivityIconType,
  type ActivityThemeColor,
} from "@/lib/patient-activities";

// Só escalas aqui. As atividades do Espaço Interativo saem da própria seção
// no menu (/dashboard/espaco-interativo), onde dá para ver cada uma antes de
// mandar — misturar as duas coisas neste seletor escondia os jogos dentro de
// uma aba chamada "Rastreio", que é outro assunto.

// Ícone por tipo — mesmo mapeamento de patient-activity-card.tsx, mas
// duplicado (não importado de lib/) de propósito: lib/ é lógica de domínio,
// sem dependência de biblioteca de ícone (ver convenção no CLAUDE.md).
const ICONES: Record<ActivityIconType, typeof Heart> = {
  heart: Heart,
  brain: Brain,
  smile: Smile,
  shield: ShieldAlert,
  star: Star,
  wind: Wind,
  users: Users,
};

// Tom claro pro chip do seletor — o banner saturado de patient-activity-card
// cabe no app do paciente; aqui é o painel do psicólogo, mais sóbrio.
const TOM: Record<ActivityThemeColor, string> = {
  roxo: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  azul: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  verde: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  laranja:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  rosa: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-300",
  sobrio: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

/** Agrupa por categoria preservando a ordem de primeira aparição — mesma
 *  taxonomia do catálogo em dashboard/link/page.tsx. */
function agruparPorCategoria(
  slugs: EscalaSlug[]
): { categoria: string; slugs: EscalaSlug[] }[] {
  const grupos: { categoria: string; slugs: EscalaSlug[] }[] = [];
  for (const slug of slugs) {
    const categoria = APRESENTACAO[slug].categoria ?? "Outras";
    const grupo = grupos.find((g) => g.categoria === categoria);
    if (grupo) grupo.slugs.push(slug);
    else grupos.push({ categoria, slugs: [slug] });
  }
  return grupos;
}

const GRUPOS = agruparPorCategoria(ESCALAS_DISPONIVEIS.map((e) => e.slug));

/**
 * Envia uma atividade direto da ficha, em vez de obrigar o desvio por
 * "Meu Link" → escolher o paciente de novo numa lista.
 *
 * Se o paciente tem conta, o convite já aparece no Espaço Interativo dele
 * (ver minhas_atividades no schema.sql) — o link copiado continua existindo
 * para quem prefere mandar por WhatsApp, ou para quem ainda não tem conta.
 */
export function EnviarAtividade({
  pacienteId,
  temConta,
}: {
  pacienteId: string;
  temConta: boolean;
}) {
  const { user } = useAuth();
  const [selecao, setSelecao] = useState<EscalaSlug | "">("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const info = selecao ? APRESENTACAO[selecao] : null;

  function selecionar(slug: EscalaSlug) {
    setSelecao((atual) => (atual === slug ? "" : slug));
    setLink(null);
    setErro(null);
  }

  async function handleEnviar() {
    if (!selecao || !user) return;
    setEnviando(true);
    setErro(null);
    setLink(null);
    try {
      const token = await gerarConviteEscala(
        createClient(),
        pacienteId,
        selecao
      );
      setLink(
        `${window.location.origin}/escala/${user.id}/${selecao}?c=${token}`
      );
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar a atividade."
      );
    } finally {
      setEnviando(false);
    }
  }

  async function handleCopiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
        Enviar escala de rastreio
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {temConta
          ? "A escala aparece no Espaço Interativo do paciente assim que você enviar. O link abaixo serve se preferir mandar por WhatsApp."
          : "Este paciente ainda não tem conta, então envie o link pelo WhatsApp. Com conta, a escala apareceria sozinha no Espaço Interativo dele."}
      </p>

      <div className="mt-3 space-y-3">
        {GRUPOS.map((grupo) => (
          <div key={grupo.categoria}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
              {grupo.categoria}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {grupo.slugs.map((slug) => {
                const item = APRESENTACAO[slug];
                const Icone = ICONES[item.iconType];
                const selecionado = selecao === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => selecionar(slug)}
                    aria-pressed={selecionado}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selecionado
                        ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500 dark:bg-brand-950/50 dark:text-brand-300"
                        : `${TOM[item.themeColor]} hover:brightness-95 dark:hover:brightness-125`
                    }`}
                  >
                    <Icone className="h-3.5 w-3.5 shrink-0" />
                    {item.instrumento}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {info && (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {info.instrumento}
                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                  {" "}
                  — {info.title}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {info.description}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
              {info.estimatedTime}
            </span>
          </div>

          {info.sensivel && (
            <p className="mt-2.5 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              Instrumento sensível — vale ver a resposta assim que ela chegar,
              sem esperar a próxima consulta.
            </p>
          )}

          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar {info.instrumento}
          </button>
        </div>
      )}

      {erro && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{erro}</p>
      )}

      {link && (
        <div className="mt-3">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {temConta
              ? "Pronto — já está no Espaço Interativo do paciente."
              : "Atividade criada. Copie e envie o link."}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="w-full truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            />
            <button
              type="button"
              onClick={handleCopiar}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copiado ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
