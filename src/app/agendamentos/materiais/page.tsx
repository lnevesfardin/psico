"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Music, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import {
  formatarTamanho,
  listMeusMateriais,
  urlDoMaterial,
  type Material,
} from "@/lib/materiais-client";
import { formatDateShort } from "@/lib/format";

function iconeDoTipo(mime: string) {
  if (mime.startsWith("audio/")) return Music;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileText;
}

export default function MateriaisPage() {
  const { user } = useAuth();
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listMeusMateriais(supabase)
      .then(setMateriais)
      .catch(() => setError("Não foi possível carregar seus materiais."))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleAbrir(material: Material) {
    setAbrindo(material.id);
    setError(null);
    try {
      const supabase = createClient();
      const url = await urlDoMaterial(supabase, material.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível abrir o arquivo."
      );
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Materiais de apoio
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Leituras, exercícios e áudios que seu psicólogo enviou para você.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading && (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          Carregando...
        </p>
      )}

      {!loading && materiais.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <FileText className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nenhum material por aqui ainda.
          </p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Quando seu psicólogo enviar algum material, ele aparece nesta tela.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {materiais.map((material) => {
          const Icone = iconeDoTipo(material.tipoMime);
          return (
            <div
              key={material.id}
              className="flex items-start gap-4 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <Icone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">
                  {material.titulo}
                </p>
                {material.descricao && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {material.descricao}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {formatDateShort(material.createdAt)}
                  {material.tamanhoBytes > 0 &&
                    ` · ${formatarTamanho(material.tamanhoBytes)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAbrir(material)}
                disabled={abrindo === material.id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {abrindo === material.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Abrir
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
