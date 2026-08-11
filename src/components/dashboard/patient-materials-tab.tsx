"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  apagarMaterial,
  enviarMaterial,
  formatarTamanho,
  listMateriais,
  MATERIAL_MIME_TYPES_PERMITIDOS,
  MAX_MATERIAL_BYTES,
  urlDoMaterial,
  type Material,
} from "@/lib/materiais-client";
import { formatDateShort } from "@/lib/format";

function iconeDoTipo(mime: string) {
  if (mime.startsWith("audio/")) return Music;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileText;
}

export function PatientMaterialsTab({
  pacienteId,
  temConta,
}: {
  pacienteId: string;
  temConta: boolean;
}) {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    listMateriais(supabase, pacienteId)
      .then(setMateriais)
      .catch(() => setError("Não foi possível carregar os materiais."))
      .finally(() => setLoading(false));
  }, [pacienteId]);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setError(null);
    try {
      const supabase = createClient();
      const novo = await enviarMaterial(
        supabase,
        pacienteId,
        arquivo,
        titulo.trim() || arquivo.name,
        descricao
      );
      setMateriais((prev) => [novo, ...prev]);
      setTitulo("");
      setDescricao("");
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleAbrir(material: Material) {
    setAbrindo(material.id);
    setError(null);
    try {
      const supabase = createClient();
      const url = await urlDoMaterial(supabase, material.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir.");
    } finally {
      setAbrindo(null);
    }
  }

  async function handleApagar(material: Material) {
    if (!window.confirm(`Apagar "${material.titulo}"? Não dá para desfazer.`))
      return;
    setError(null);
    try {
      const supabase = createClient();
      await apagarMaterial(supabase, material);
      setMateriais((prev) => prev.filter((m) => m.id !== material.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar.");
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {!temConta && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Este paciente ainda não tem conta. Você já pode enviar materiais — ele
          vai vê-los assim que criar a conta pelo link de convite.
        </div>
      )}

      <form
        onSubmit={handleEnviar}
        className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <Upload className="h-4 w-4" />
          Enviar material
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          PDF, formulário, imagem ou áudio de meditação guiada. Até 25 MB por
          arquivo.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={MATERIAL_MIME_TYPES_PERMITIDOS.join(",")}
            required
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > MAX_MATERIAL_BYTES) {
                setError("Arquivo muito grande. O limite é 25 MB.");
                setArquivo(null);
                e.target.value = "";
                return;
              }
              setError(null);
              setArquivo(f);
              if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
            }}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700 dark:text-zinc-400"
          />

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Título
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Exercício de respiração diafragmática"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Orientação para o paciente{" "}
            <span className="font-normal text-zinc-400">(opcional)</span>
            <textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Ouça antes de dormir, durante esta semana."
              className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={enviando || !arquivo}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {enviando ? "Enviando..." : "Enviar para o paciente"}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Materiais enviados
        </h3>
        <div className="mt-3 space-y-2">
          {loading && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Carregando...
            </p>
          )}
          {!loading && materiais.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Nenhum material enviado ainda.
            </p>
          )}
          {materiais.map((material) => {
            const Icone = iconeDoTipo(material.tipoMime);
            return (
              <div
                key={material.id}
                className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Icone className="h-4 w-4" />
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
                    {formatDateShort(material.createdAt.slice(0, 10))}
                    {material.tamanhoBytes > 0 &&
                      ` · ${formatarTamanho(material.tamanhoBytes)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAbrir(material)}
                    disabled={abrindo === material.id}
                    aria-label="Abrir material"
                    className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    {abrindo === material.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApagar(material)}
                    aria-label="Apagar material"
                    className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
