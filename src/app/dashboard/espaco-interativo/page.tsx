"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Eye, Loader2, Send, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { listPatients } from "@/lib/patients-client";
import { gerarConviteJogo } from "@/lib/jogos-client";
import {
  JOGOS_DISPONIVEIS,
  PUBLICO_LABELS,
  type Jogo,
  type PublicoJogo,
} from "@/lib/jogos";
import type { Patient } from "@/lib/dashboard-data";

const PUBLICOS: PublicoJogo[] = ["adultos", "adolescentes", "criancas", "casais"];

/** Classes completas por cor — Tailwind não gera classe montada em runtime. */
const FAIXA: Record<Jogo["cor"], string> = {
  roxo: "bg-violet-500",
  azul: "bg-sky-500",
  verde: "bg-teal-500",
  laranja: "bg-orange-500",
  rosa: "bg-pink-500",
};

export default function EspacoInterativoPage() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<PublicoJogo | "todos">("todos");
  const [enviando, setEnviando] = useState<Jogo | null>(null);

  const jogos = useMemo(
    () =>
      filtro === "todos"
        ? JOGOS_DISPONIVEIS
        : JOGOS_DISPONIVEIS.filter((j) => j.publico === filtro),
    [filtro]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        <Sparkles className="h-6 w-6 text-brand-500" />
        Espaço Interativo
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
        Atividades de reflexão e regulação para o paciente fazer entre as
        sessões. Você escolhe o que enviar e para quem — elas não ficam
        disponíveis sozinhas. As respostas voltam na ficha do paciente, na aba
        Rastreio.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["todos", ...PUBLICOS] as const).map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filtro === valor
                ? "bg-brand-600 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {valor === "todos" ? "Todas" : PUBLICO_LABELS[valor]}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jogos.map((jogo) => (
          <article
            key={jogo.slug}
            className="flex flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className={`h-1.5 ${FAIXA[jogo.cor]}`} />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  {jogo.nome}
                </h2>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {jogo.duracao}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                {PUBLICO_LABELS[jogo.publico]}
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {jogo.descricao}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {jogo.temas.map((tema) => (
                  <span
                    key={tema}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {tema}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/jogo/${jogo.slug}?preview=1`}
                  target="_blank"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver
                </Link>
                <button
                  type="button"
                  onClick={() => setEnviando(jogo)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {enviando && user && (
        <ModalEnviar
          jogo={enviando}
          psicologoId={user.id}
          onClose={() => setEnviando(null)}
        />
      )}
    </div>
  );
}

function ModalEnviar({
  jogo,
  psicologoId,
  onClose,
}: {
  jogo: Jogo;
  psicologoId: string;
  onClose: () => void;
}) {
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [pacienteId, setPacienteId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    listPatients(createClient(), psicologoId)
      .then(setPacientes)
      .catch(() => setErro("Não foi possível carregar seus pacientes."))
      .finally(() => setCarregando(false));
  }, [psicologoId]);

  const paciente = pacientes.find((p) => p.id === pacienteId);

  async function handleEnviar() {
    if (!pacienteId) return;
    setGerando(true);
    setErro(null);
    try {
      const token = await gerarConviteJogo(createClient(), pacienteId, jogo.slug);
      setLink(`${window.location.origin}/jogo/${jogo.slug}?c=${token}`);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar o link."
      );
    } finally {
      setGerando(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Enviar atividade
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {jogo.nome}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Para qual paciente?
          <select
            value={pacienteId}
            onChange={(e) => {
              setPacienteId(e.target.value);
              setLink(null);
            }}
            disabled={carregando}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">
              {carregando ? "Carregando..." : "Selecione..."}
            </option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {erro && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{erro}</p>
        )}

        {!link ? (
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!pacienteId || gerando}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gerando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar atividade
          </button>
        ) : (
          <div className="mt-5">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {paciente?.clienteUserId
                ? "Pronto — já está no Espaço Interativo do paciente."
                : "Atividade criada. Como este paciente não tem conta, envie o link abaixo."}
            </p>
            <div className="mt-2 flex items-center gap-2">
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
    </div>
  );
}
