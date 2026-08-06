"use client";

import { useEffect, useState } from "react";
import { BookLock, Eye, Loader2, Lock, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import {
  alterarVisibilidade,
  apagarEntradaDiario,
  criarEntradaDiario,
  listDiario,
  type EntradaDiario,
  type Visibilidade,
} from "@/lib/diario-client";
import { formatDateTime } from "@/lib/format";

export default function DiarioPage() {
  const { user } = useAuth();
  const [entradas, setEntradas] = useState<EntradaDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [conteudo, setConteudo] = useState("");
  // Nasce privada de propósito: compartilhar é um ato deliberado, não o
  // padrão — é o diário da pessoa, não um relatório para o psicólogo.
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("privada");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listDiario(supabase, user.id)
      .then(setEntradas)
      .catch(() => setError("Não foi possível carregar seu diário."))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const texto = conteudo.trim();
    if (!texto) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const nova = await criarEntradaDiario(supabase, user.id, texto, visibilidade);
      setEntradas((prev) => [nova, ...prev]);
      setConteudo("");
      setVisibilidade("privada");
    } catch {
      setError("Não foi possível salvar sua anotação.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAlternar(entrada: EntradaDiario) {
    const nova: Visibilidade =
      entrada.visibilidade === "privada" ? "compartilhada" : "privada";
    if (nova === "compartilhada") {
      const ok = window.confirm(
        "Compartilhar esta anotação com seu psicólogo? Ele passará a ver o texto completo."
      );
      if (!ok) return;
    }
    setEntradas((prev) =>
      prev.map((e) => (e.id === entrada.id ? { ...e, visibilidade: nova } : e))
    );
    try {
      const supabase = createClient();
      await alterarVisibilidade(supabase, entrada.id, nova);
    } catch {
      // Desfaz o otimismo: sem isso a tela mentiria dizendo "privada"
      // enquanto o psicólogo continua enxergando a anotação.
      setEntradas((prev) =>
        prev.map((e) =>
          e.id === entrada.id ? { ...e, visibilidade: entrada.visibilidade } : e
        )
      );
      setError("Não foi possível alterar a privacidade. Tente de novo.");
    }
  }

  async function handleApagar(entrada: EntradaDiario) {
    if (!window.confirm("Apagar esta anotação? Não dá para desfazer.")) return;
    try {
      const supabase = createClient();
      await apagarEntradaDiario(supabase, entrada.id);
      setEntradas((prev) => prev.filter((e) => e.id !== entrada.id));
    } catch {
      setError("Não foi possível apagar a anotação.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Meu diário
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Escreva o que quiser. Cada anotação começa privada — só o que você
        marcar como compartilhada aparece para o seu psicólogo.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSalvar}
        className="mt-6 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={5}
          placeholder="Como foi seu dia? O que passou pela sua cabeça?"
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-950">
            {(
              [
                { value: "privada", label: "Privada", icon: Lock },
                { value: "compartilhada", label: "Compartilhar", icon: Eye },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibilidade(value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  visibilidade === value
                    ? "bg-brand-600 text-white"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving || !conteudo.trim()}
            className="shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar anotação"}
          </button>
        </div>
      </form>

      {loading && (
        <p className="mt-8 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </p>
      )}

      {!loading && entradas.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <BookLock className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Seu diário está vazio.
          </p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            O que você escrever aqui fica só com você, a não ser que escolha
            compartilhar.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {entradas.map((entrada) => {
          const compartilhada = entrada.visibilidade === "compartilhada";
          return (
            <div
              key={entrada.id}
              className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {formatDateTime(entrada.createdAt)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAlternar(entrada)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      compartilhada
                        ? "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                    title={
                      compartilhada
                        ? "Tornar privada de novo"
                        : "Compartilhar com meu psicólogo"
                    }
                  >
                    {compartilhada ? (
                      <>
                        <Eye className="h-3 w-3" />
                        Compartilhada
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        Privada
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApagar(entrada)}
                    aria-label="Apagar anotação"
                    className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {entrada.conteudo}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
