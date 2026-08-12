"use client";

import { useState } from "react";
import { CheckCircle2, Phone, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enviarRespostaEscala } from "@/lib/respostas-escala-client";
import type { Escala, EscalaCssrs, EscalaLikert, RespostaCssrs, RespostaLikert } from "@/lib/escalas";

function SafetyBanner() {
  return (
    <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <div className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        Se você estiver passando por um momento difícil agora
      </div>
      <p className="mt-1.5 leading-relaxed">
        Ligue{" "}
        <a
          href="tel:188"
          className="inline-flex items-center gap-1 font-bold text-amber-600 underline decoration-2 underline-offset-4 dark:text-amber-300"
        >
          <Phone className="h-3.5 w-3.5" />
          188
        </a>{" "}
        (CVV, gratuito, 24h) ou vá à unidade de saúde mais próxima. Este
        formulário não é um canal de socorro nem monitorado em tempo real.
      </p>
    </div>
  );
}

function LikertForm({
  escala,
  respostas,
  onChange,
}: {
  escala: EscalaLikert;
  respostas: RespostaLikert;
  onChange: (r: RespostaLikert) => void;
}) {
  function setValor(itemId: string, valor: number) {
    onChange({ ...respostas, [itemId]: valor });
  }

  return (
    <div className="mt-6 space-y-5">
      {escala.itens.map((item, i) => (
        <fieldset
          key={item.id}
          className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {i + 1}. {item.texto}
          </legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {escala.opcoes.map((opcao) => (
              <label
                key={opcao.valor}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              >
                <input
                  type="radio"
                  name={item.id}
                  checked={respostas[item.id] === opcao.valor}
                  onChange={() => setValor(item.id, opcao.valor)}
                  className="h-4 w-4 accent-brand-600"
                />
                {opcao.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {escala.itemExtra && (
        <fieldset className="rounded-xl border border-dashed border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {escala.itemExtra.texto}{" "}
            <span className="text-xs text-zinc-400 dark:text-zinc-600">(opcional)</span>
          </legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {escala.itemExtra.opcoes.map((opcao) => (
              <label
                key={opcao.valor}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              >
                <input
                  type="radio"
                  name={escala.itemExtra!.id}
                  checked={respostas[escala.itemExtra!.id] === opcao.valor}
                  onChange={() => setValor(escala.itemExtra!.id, opcao.valor)}
                  className="h-4 w-4 accent-brand-600"
                />
                {opcao.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function YesNoQuestion({
  texto,
  value,
  onChange,
}: {
  texto: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {texto}
      </legend>
      <div className="mt-2 flex gap-2">
        {[
          { label: "Sim", v: true },
          { label: "Não", v: false },
        ].map((opcao) => (
          <button
            key={opcao.label}
            type="button"
            onClick={() => onChange(opcao.v)}
            className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-colors ${
              value === opcao.v
                ? "bg-brand-600 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {opcao.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CssrsForm({
  escala,
  respostas,
  onChange,
}: {
  escala: EscalaCssrs;
  respostas: RespostaCssrs;
  onChange: (r: RespostaCssrs) => void;
}) {
  const [q1, q2, q3, q4, q5, q6] = escala.itens;
  function set(id: string, v: boolean) {
    onChange({ ...respostas, [id]: v });
  }

  return (
    <div className="mt-6 space-y-4">
      <YesNoQuestion texto={q1.texto} value={respostas.q1} onChange={(v) => set("q1", v)} />
      <YesNoQuestion texto={q2.texto} value={respostas.q2} onChange={(v) => set("q2", v)} />

      {respostas.q2 && (
        <>
          <YesNoQuestion texto={q3.texto} value={respostas.q3} onChange={(v) => set("q3", v)} />
          <YesNoQuestion texto={q4.texto} value={respostas.q4} onChange={(v) => set("q4", v)} />
          <YesNoQuestion texto={q5.texto} value={respostas.q5} onChange={(v) => set("q5", v)} />
        </>
      )}

      <YesNoQuestion texto={q6.texto} value={respostas.q6} onChange={(v) => set("q6", v)} />
      {respostas.q6 && (
        <YesNoQuestion
          texto="Isso aconteceu nos últimos 3 meses?"
          value={respostas.q6_3meses}
          onChange={(v) => set("q6_3meses", v)}
        />
      )}
    </div>
  );
}

function cssrsCompleto(escala: EscalaCssrs, r: RespostaCssrs): boolean {
  if (r.q1 === undefined || r.q2 === undefined || r.q6 === undefined) return false;
  if (r.q2 && (r.q3 === undefined || r.q4 === undefined || r.q5 === undefined)) return false;
  if (r.q6 && r.q6_3meses === undefined) return false;
  return true;
}

export function EscalaWizard({
  psicologoId,
  psicologoNome,
  escala,
  token,
}: {
  psicologoId: string;
  psicologoNome: string;
  escala: Escala;
  /** Presente quando o link foi gerado para uma ficha específica. */
  token?: string;
}) {
  const [pacienteNome, setPacienteNome] = useState("");
  const [respostasLikert, setRespostasLikert] = useState<RespostaLikert>({});
  const [respostasCssrs, setRespostasCssrs] = useState<RespostaCssrs>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completo =
    escala.tipo === "likert"
      ? escala.itens.every((item) => respostasLikert[item.id] !== undefined)
      : cssrsCompleto(escala, respostasCssrs);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      await enviarRespostaEscala(supabase, {
        psicologoId,
        escala: escala.slug,
        pacienteNome,
        respostas: escala.tipo === "likert" ? respostasLikert : respostasCssrs,
        token,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Muitas respostas")
          ? err.message
          : "Não foi possível enviar suas respostas. Tente novamente em instantes."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Respostas enviadas
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Obrigado por responder. Suas respostas foram enviadas para{" "}
          {psicologoNome}.
        </p>
        <div className="w-full">
          <SafetyBanner />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
        Solicitado por {psicologoNome}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {escala.nome}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{escala.descricaoCurta}</p>
      <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        {escala.instrucao}
      </p>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
        Instrumento de triagem, não de diagnóstico — suas respostas serão
        analisadas pelo profissional que solicitou este questionário.
      </p>

      <SafetyBanner />

      <label className="mt-6 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Seu nome{" "}
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-600">
          (opcional)
        </span>
        <input
          type="text"
          value={pacienteNome}
          onChange={(e) => setPacienteNome(e.target.value)}
          placeholder="Não é obrigatório preencher"
          className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
      </label>

      {escala.tipo === "likert" ? (
        <LikertForm
          escala={escala}
          respostas={respostasLikert}
          onChange={setRespostasLikert}
        />
      ) : (
        <CssrsForm escala={escala} respostas={respostasCssrs} onChange={setRespostasCssrs} />
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!completo || submitting}
        className="mt-6 w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Enviando..." : "Enviar respostas"}
      </button>
    </div>
  );
}
