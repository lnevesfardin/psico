"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import {
  PLACEHOLDER_TOKENS,
  type DocumentTemplate,
  type DocumentTemplateInput,
} from "@/lib/document-templates";
import { ensureHtml } from "@/lib/rich-text";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/ui/rich-text-editor";

export function DocumentTemplateFormModal({
  title,
  submitLabel,
  initialValues,
  onClose,
  onSave,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initialValues?: DocumentTemplateInput;
  onClose: () => void;
  onSave: (input: DocumentTemplateInput) => Promise<DocumentTemplate>;
  onSaved: (template: DocumentTemplate) => void;
}) {
  const [tipo, setTipo] = useState(initialValues?.tipo ?? "");
  const [nome, setNome] = useState(initialValues?.nome ?? "");
  const [conteudo, setConteudo] = useState(
    ensureHtml(initialValues?.conteudo ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  function inserirToken(token: string) {
    editorRef.current?.insertText(token);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const template = await onSave({ tipo: tipo.trim(), nome: nome.trim(), conteudo });
      onSaved(template);
    } catch {
      setError("Não foi possível salvar o modelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Categoria
            <input
              type="text"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Ex.: Atestado, Laudo, Declaração..."
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nome do modelo
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Atestado Psicológico"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Conteúdo
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Clique num campo abaixo para inserir no texto — ele é preenchido
            sozinho na hora de gerar o documento para um paciente.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLACEHOLDER_TOKENS.map(({ token, label }) => (
              <button
                key={token}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => inserirToken(token)}
                title={token}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <RichTextEditor ref={editorRef} content={conteudo} onChange={setConteudo} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
