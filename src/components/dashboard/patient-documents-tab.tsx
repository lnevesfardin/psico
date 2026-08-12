"use client";

import { useEffect, useState } from "react";
import { Download, FileSignature, HelpCircle, Printer, Save, Trash2 } from "lucide-react";
import type { Patient } from "@/lib/dashboard-data";
import { useAuth } from "@/context/auth-context";
import { useProfile } from "@/context/profile-context";
import { createClient } from "@/lib/supabase/client";
import {
  fillPlaceholders,
  listDocumentTemplates,
  type DocumentTemplate,
} from "@/lib/document-templates";
import {
  apagarDocumentoEmitido,
  criarDocumentoEmitido,
  listDocumentosEmitidos,
  type DocumentoEmitido,
} from "@/lib/documentos-emitidos-client";
import { formatDateTime } from "@/lib/format";
import { ensureHtml } from "@/lib/rich-text";
import { downloadAsWord } from "@/lib/download-doc";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DocumentHowItWorksModal } from "@/components/dashboard/document-how-it-works-modal";

export function PatientDocumentsTab({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const { profile } = useProfile();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [historico, setHistorico] = useState<DocumentoEmitido[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [rascunho, setRascunho] = useState<{
    tipo: string;
    modeloNome: string;
    conteudo: string;
  } | null>(null);
  // Muda a cada novo rascunho carregado — usado como key do editor pra
  // forçar ele a remontar com o conteúdo novo (o TipTap só lê "content" na
  // primeira montagem, ver rich-text-editor.tsx).
  const [rascunhoVersion, setRascunhoVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imprimindo, setImprimindo] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      listDocumentTemplates(supabase, user.id),
      listDocumentosEmitidos(supabase, patient.id),
    ])
      .then(([t, h]) => {
        setTemplates(t);
        setHistorico(h);
      })
      .finally(() => setLoading(false));
  }, [user, patient.id]);

  function handleUsarModelo() {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;
    setRascunho({
      tipo: template.tipo,
      modeloNome: template.nome,
      conteudo: ensureHtml(
        fillPlaceholders(template.conteudo, patient, profile, new Date())
      ),
    });
    setRascunhoVersion((v) => v + 1);
  }

  function nomeArquivo(modeloNome: string): string {
    // Sem acento/caractere especial: alguns sistemas de arquivo (e o
    // Explorer no Windows) lidam mal com eles em downloads automáticos.
    const base = `${modeloNome} - ${patient.name}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // marcas de acento pós-NFD
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim();
    return `${base}.doc`;
  }

  function baixarConteudo(conteudo: string, modeloNome: string) {
    downloadAsWord(ensureHtml(conteudo), nomeArquivo(modeloNome));
  }

  function imprimirConteudo(conteudo: string, id: string) {
    setImprimindo(id);
    // O conteúdo precisa estar no DOM (na div #documento-para-impressao)
    // antes do print disparar — daí o requestAnimationFrame em vez de
    // chamar window.print() direto após o setState.
    requestAnimationFrame(() => {
      window.print();
      setImprimindo(null);
    });
  }

  async function handleSalvarEImprimir() {
    if (!rascunho) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const documento = await criarDocumentoEmitido(supabase, patient.id, rascunho);
      setHistorico((prev) => [documento, ...prev]);
      setRascunho(null);
      setSelectedTemplateId("");
      imprimirConteudo(documento.conteudo, documento.id);
    } catch {
      setError("Não foi possível salvar o documento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApagar(documento: DocumentoEmitido) {
    const confirmed = window.confirm(
      `Apagar "${documento.modeloNome}" gerado em ${formatDateTime(documento.createdAt)}? Não pode ser desfeito.`
    );
    if (!confirmed) return;
    setDeletingId(documento.id);
    try {
      const supabase = createClient();
      await apagarDocumentoEmitido(supabase, documento.id);
      setHistorico((prev) => prev.filter((d) => d.id !== documento.id));
    } catch {
      window.alert("Não foi possível apagar o documento.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>;
  }

  const conteudoParaImprimir =
    imprimindo && historico.find((d) => d.id === imprimindo)?.conteudo;

  return (
    <div className="mt-6 space-y-6">
      <button
        type="button"
        onClick={() => setHowItWorksOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <HelpCircle className="h-4 w-4" />
        Como funciona?
      </button>

      {templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
          Nenhum modelo de documento cadastrado ainda. Crie modelos em{" "}
          <span className="font-medium">Modelos de Documentos</span>, no menu
          lateral, para gerar documentos aqui.
        </p>
      ) : (
        <div className="rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Escolha um modelo
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Selecione...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tipo} · {t.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleUsarModelo}
                disabled={!selectedTemplateId}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSignature className="h-4 w-4" />
                Usar modelo
              </button>
            </div>
          </label>
        </div>
      )}

      {rascunho && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {rascunho.modeloNome}
            </p>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {rascunho.tipo}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Revise e complete o texto antes de salvar — campos entre colchetes
            precisam ser preenchidos manualmente.
          </p>
          <div className="mt-3">
            <RichTextEditor
              key={rascunhoVersion}
              content={rascunho.conteudo}
              onChange={(html) =>
                setRascunho((prev) => (prev ? { ...prev, conteudo: html } : prev))
              }
            />
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRascunho(null)}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleSalvarEImprimir}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar e imprimir"}
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Documentos emitidos
        </h3>
        <div className="mt-3 space-y-2">
          {historico.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Nenhum documento emitido ainda.
            </p>
          )}
          {historico.map((documento) => (
            <div
              key={documento.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                  {documento.modeloNome}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {documento.tipo} · {formatDateTime(documento.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => baixarConteudo(documento.conteudo, documento.modeloNome)}
                  aria-label="Baixar como Word"
                  title="Baixar como Word (.doc)"
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => imprimirConteudo(documento.conteudo, documento.id)}
                  aria-label="Imprimir"
                  title="Imprimir ou salvar como PDF"
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleApagar(documento)}
                  disabled={deletingId === documento.id}
                  aria-label="Apagar"
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {howItWorksOpen && (
        <DocumentHowItWorksModal onClose={() => setHowItWorksOpen(false)} />
      )}

      {conteudoParaImprimir && (
        <div id="documento-para-impressao" className="hidden print:block">
          {/* Conteúdo é HTML gerado pelo próprio editor rico (rich-text-editor.tsx)
              do psicólogo dono da conta — nunca de terceiros — mesmo padrão de
              confiança já usado nos outros campos que ele preenche sobre si
              mesmo/seus pacientes. */}
          <div
            className="rich-doc text-sm leading-6 text-black"
            dangerouslySetInnerHTML={{ __html: ensureHtml(conteudoParaImprimir) }}
          />
        </div>
      )}
    </div>
  );
}
