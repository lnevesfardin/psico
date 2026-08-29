"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Trash2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  apagarRespostaEscala,
  listRespostasEscala,
  listRespostasEscalaPaciente,
  type RespostaEscala,
} from "@/lib/respostas-escala-client";
import {
  calcularCssrs,
  calcularLikert,
  getEscala,
  type RespostaCssrs,
  type RespostaLikert,
} from "@/lib/escalas";
import { formatDateTime } from "@/lib/format";

type Tom = "risco" | "atencao" | "neutro";

function resumoResposta(resposta: RespostaEscala): { rotulo: string; tom: Tom } {
  const escala = getEscala(resposta.escala);
  if (!escala) return { rotulo: "Escala desconhecida", tom: "neutro" };

  if (escala.tipo === "cssrs") {
    const r = calcularCssrs(resposta.respostas as RespostaCssrs);
    return {
      rotulo: r.rotulo,
      tom: r.nivel === "nenhum" ? "neutro" : r.nivel === "moderado" ? "atencao" : "risco",
    };
  }

  const r = calcularLikert(escala, resposta.respostas as RespostaLikert);
  if (r.alertaRisco) {
    return { rotulo: `${r.faixa} — item de risco assinalado`, tom: "risco" };
  }
  if (escala.dominios) {
    return { rotulo: r.faixa, tom: r.faixa.startsWith("Sintomatologia") ? "atencao" : "neutro" };
  }
  if (escala.subescalas) {
    // "atencao" se qualquer subescala (Depressão/Ansiedade/Estresse na
    // DASS-21) cair em "Moderado" ou pior — as três são independentes, uma
    // só elevada já merece o aviso, mesmo com as outras duas normais.
    const elevado = r.porSubescala?.some((s) => s.elevado) ?? false;
    return { rotulo: r.faixa, tom: elevado ? "atencao" : "neutro" };
  }
  return {
    rotulo: `${r.faixa} (${r.total}/${escala.faixas[escala.faixas.length - 1]?.max ?? r.total})`,
    tom: r.total >= escala.corte.valor ? "atencao" : "neutro",
  };
}

const TOM_CLASSES: Record<Tom, string> = {
  risco: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  atencao: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  neutro: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function DetalheResposta({ resposta }: { resposta: RespostaEscala }) {
  const escala = getEscala(resposta.escala);
  if (!escala) return null;

  if (escala.tipo === "cssrs") {
    const r = resposta.respostas as RespostaCssrs;
    return (
      <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {calcularCssrs(r).conduta}
        </p>
        {escala.itens.map((item, i) => {
          const valor = r[item.id];
          if (valor === undefined) return null;
          return (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <span className="text-zinc-600 dark:text-zinc-400">
                {i + 1}. {item.texto}
              </span>
              <span className="shrink-0 font-medium text-zinc-900 dark:text-white">
                {valor ? "Sim" : "Não"}
              </span>
            </div>
          );
        })}
        {r.q6 && (
          <div className="flex items-start justify-between gap-3">
            <span className="text-zinc-600 dark:text-zinc-400">
              Item 6 aconteceu nos últimos 3 meses?
            </span>
            <span className="shrink-0 font-medium text-zinc-900 dark:text-white">
              {r.q6_3meses ? "Sim" : "Não"}
            </span>
          </div>
        )}
      </div>
    );
  }

  const respostasLikert = resposta.respostas as RespostaLikert;
  return (
    <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
      {escala.itens.map((item, i) => {
        const valor = respostasLikert[item.id];
        // item.opcoes só existe quando a redação de resposta é própria dessa
        // pergunta (ex.: EPDS) — mesma regra de escala-wizard.tsx.
        const opcao = (item.opcoes ?? escala.opcoes).find((o) => o.valor === valor);
        return (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <span className="text-zinc-600 dark:text-zinc-400">
              {i + 1}. {item.texto}
            </span>
            <span className="shrink-0 font-medium text-zinc-900 dark:text-white">
              {opcao?.label ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Duas visões da mesma lista: todas as respostas recebidas pelo psicólogo
 * (psicologoId) ou só o histórico de uma ficha (pacienteId, aba Rastreio).
 * Exatamente um dos dois é informado.
 */
export function RespostasEscalaList({
  psicologoId,
  pacienteId,
}: {
  psicologoId?: string;
  pacienteId?: string;
}) {
  const [respostas, setRespostas] = useState<RespostaEscala[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const busca = pacienteId
      ? listRespostasEscalaPaciente(supabase, pacienteId)
      : psicologoId
        ? listRespostasEscala(supabase, psicologoId)
        : Promise.resolve([]);
    busca
      .then(setRespostas)
      .catch(() => setRespostas([]))
      .finally(() => setLoading(false));
  }, [psicologoId, pacienteId]);

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Apagar esta resposta? Não pode ser desfeito.");
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      await apagarRespostaEscala(supabase, id);
      setRespostas((prev) => prev.filter((r) => r.id !== id));
    } catch {
      window.alert("Não foi possível apagar esta resposta.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  if (respostas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        {pacienteId
          ? "Nenhuma escala respondida por este paciente ainda."
          : "Nenhuma resposta recebida ainda."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {respostas.map((resposta) => {
        const escala = getEscala(resposta.escala);
        const resumo = resumoResposta(resposta);
        const expanded = expandedId === resposta.id;
        return (
          <div
            key={resposta.id}
            className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : resposta.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {escala?.nome ?? resposta.escala}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TOM_CLASSES[resumo.tom]}`}
                  >
                    {resumo.tom === "risco" && <AlertTriangle className="h-3 w-3" />}
                    {resumo.rotulo}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <User className="h-3 w-3" />
                  {/* Na ficha, repetir o nome do paciente em toda linha é
                      ruído — só aparece se quem respondeu digitou outro nome
                      (ex.: responsável preenchendo o SNAP-IV pela criança). */}
                  {pacienteId
                    ? resposta.pacienteNome
                      ? `Respondido por ${resposta.pacienteNome} · `
                      : ""
                    : `${resposta.pacienteNome || "Não identificado"} · `}
                  {formatDateTime(resposta.createdAt)}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>

            {expanded && (
              <>
                <DetalheResposta resposta={resposta} />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDelete(resposta.id)}
                    disabled={deletingId === resposta.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 transition-colors hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === resposta.id ? "Apagando..." : "Apagar resposta"}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
