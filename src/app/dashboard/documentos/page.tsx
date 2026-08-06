"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, LayoutTemplate, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  listDocumentTemplates,
  updateDocumentTemplate,
  type DocumentTemplate,
} from "@/lib/document-templates";
import { DocumentTemplateFormModal } from "@/components/dashboard/document-template-form-modal";
import { DocumentTemplatePresetPicker } from "@/components/dashboard/document-template-preset-picker";

export default function DocumentosPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [presetOpen, setPresetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listDocumentTemplates(supabase, user.id)
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [user]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DocumentTemplate[]>();
    for (const template of templates) {
      const list = groups.get(template.tipo) ?? [];
      list.push(template);
      groups.set(template.tipo, list);
    }
    return groups;
  }, [templates]);

  async function handleDelete(template: DocumentTemplate) {
    const confirmed = window.confirm(`Apagar o modelo "${template.nome}"?`);
    if (!confirmed) return;
    setDeletingId(template.id);
    try {
      const supabase = createClient();
      await deleteDocumentTemplate(supabase, template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch {
      window.alert("Não foi possível apagar o modelo.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Modelos de Documentos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Customize modelos de atestado, laudo, contrato e outros documentos
            para gerar rapidamente na ficha de cada paciente.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setPresetOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Sparkles className="h-4 w-4" />
            Modelos prontos
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Criar modelo
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center dark:border-zinc-800">
          <LayoutTemplate className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum modelo cadastrado ainda. Comece pelos modelos prontos ou
            crie um do zero.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {Array.from(grouped.entries()).map(([tipo, items]) => (
            <div key={tipo}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                {tipo}
              </h2>
              <div className="mt-2 space-y-2">
                {items.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        <FileText className="h-4 w-4" />
                      </span>
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                        {template.nome}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(template);
                          setFormOpen(true);
                        }}
                        aria-label="Editar modelo"
                        className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(template)}
                        disabled={deletingId === template.id}
                        aria-label="Apagar modelo"
                        className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {presetOpen && (
        <DocumentTemplatePresetPicker
          existingNames={templates.map((t) => t.nome)}
          onClose={() => setPresetOpen(false)}
          onPick={async (preset) => {
            if (!user) return;
            const supabase = createClient();
            const created = await createDocumentTemplate(supabase, user.id, preset);
            setTemplates((prev) => [...prev, created]);
          }}
        />
      )}

      {formOpen && user && (
        <DocumentTemplateFormModal
          title={editing ? "Editar modelo" : "Criar modelo"}
          submitLabel={editing ? "Salvar alterações" : "Criar modelo"}
          initialValues={editing ?? undefined}
          onClose={() => setFormOpen(false)}
          onSave={(input) => {
            const supabase = createClient();
            return editing
              ? updateDocumentTemplate(supabase, editing.id, input)
              : createDocumentTemplate(supabase, user.id, input);
          }}
          onSaved={(template) => {
            setTemplates((prev) =>
              editing
                ? prev.map((t) => (t.id === template.id ? template : t))
                : [...prev, template]
            );
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
