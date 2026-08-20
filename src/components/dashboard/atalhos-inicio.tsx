"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Plus, Settings2, X } from "lucide-react";
import {
  ATALHOS_DISPONIVEIS,
  atalhoPorId,
  atalhosPadrao,
  lerAtalhos,
  salvarAtalhos,
  subscribeAtalhos,
  type Atalho,
  type AtalhoId,
} from "@/lib/atalhos-dashboard";

/**
 * Atalhos da tela de Início, escolhidos pelo próprio psicólogo.
 *
 * A escolha fica no navegador (localStorage), como o tema e o menu recolhido
 * — não no banco. É preferência de tela, e guardar no banco custaria mais uma
 * migração manual no Supabase para algo que não é dado clínico. O preço é ser
 * por dispositivo: quem usa computador e celular escolhe em cada um.
 */
export function AtalhosInicio({
  editando,
  onEditandoChange,
}: {
  editando: boolean;
  onEditandoChange: (editando: boolean) => void;
}) {
  const escolhidos = useSyncExternalStore(
    subscribeAtalhos,
    lerAtalhos,
    atalhosPadrao
  );

  const ativos = escolhidos
    .map(atalhoPorId)
    .filter((a): a is Atalho => Boolean(a));

  const disponiveis = ATALHOS_DISPONIVEIS.filter(
    (a) => !escolhidos.includes(a.id)
  );

  function remover(id: AtalhoId) {
    salvarAtalhos(escolhidos.filter((atual) => atual !== id));
  }

  function adicionar(id: AtalhoId) {
    salvarAtalhos([...escolhidos, id]);
  }

  return (
    <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Atalhos
        </h2>
        <button
          type="button"
          onClick={() => onEditandoChange(!editando)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-brand-400"
        >
          {editando ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Concluir
            </>
          ) : (
            <>
              <Settings2 className="h-3.5 w-3.5" />
              Personalizar
            </>
          )}
        </button>
      </div>

      {ativos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
          {editando
            ? "Nenhum atalho por enquanto. Escolha abaixo os que quiser."
            : "Nenhum atalho. Toque em Personalizar para escolher."}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ativos.map((atalho) =>
            editando ? (
              // Em modo de edição o cartão deixa de ser link: clicar aqui é
              // para configurar, não para navegar embora da tela.
              <div
                key={atalho.id}
                className="relative flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-3 dark:border-zinc-700"
              >
                <ConteudoAtalho atalho={atalho} />
                <button
                  type="button"
                  onClick={() => remover(atalho.id)}
                  aria-label={`Remover atalho ${atalho.titulo}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 p-1 text-white transition-transform hover:scale-110"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Link
                key={atalho.id}
                href={atalho.href}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-zinc-800 dark:hover:border-brand-900 dark:hover:bg-brand-950/20"
              >
                <ConteudoAtalho atalho={atalho} />
              </Link>
            )
          )}
        </div>
      )}

      {editando && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {disponiveis.length > 0
              ? "Toque para adicionar:"
              : "Todos os atalhos já estão na sua tela."}
          </p>
          {disponiveis.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {disponiveis.map((atalho) => {
                const Icone = atalho.icone;
                return (
                  <button
                    key={atalho.id}
                    type="button"
                    onClick={() => adicionar(atalho.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/30 dark:hover:text-brand-300"
                  >
                    <Plus className="h-3 w-3" />
                    <Icone className="h-3.5 w-3.5" />
                    {atalho.titulo}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ConteudoAtalho({ atalho }: { atalho: Atalho }) {
  const Icone = atalho.icone;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
          {atalho.titulo}
        </span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {atalho.descricao}
        </span>
      </span>
    </>
  );
}
