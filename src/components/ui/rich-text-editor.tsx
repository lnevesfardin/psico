"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";

export type RichTextEditorHandle = {
  /** Insere texto na posição do cursor — usado pelos botões de placeholder. */
  insertText: (text: string) => void;
};

const btnBase =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-zinc-600 transition-colors hover:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-700";
const btnActive = "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-white";

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Sem isso, o mousedown no botão rouba o foco do editor antes do
      // clique completar — a seleção de texto colapsa, e o comando (negrito,
      // título etc.) roda sem nada selecionado em vez de aplicar no texto
      // que o usuário tinha marcado.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${btnBase} ${active ? btnActive : ""}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-zinc-300 dark:bg-zinc-600" />;
}

// Referências estáveis fora do componente: o TipTap resincroniza suas
// opções a cada render comparando por igualdade referencial (===) — um
// array/objeto recriado inline a cada render nunca é "igual" ao anterior, e
// isso disparava editor.setOptions(...) sem parar, corrompendo a edição em
// andamento (ver useState(content) abaixo para a outra metade do problema).
const EXTENSIONS = [StarterKit, TextAlign.configure({ types: ["heading", "paragraph"] })];
const EDITOR_PROPS = {
  attributes: {
    class:
      "min-h-[420px] max-w-none px-10 py-10 text-sm leading-7 text-zinc-900 focus:outline-none rich-doc",
  },
};

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
      <ToolbarButton
        label="Desfazer"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Refazer"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* Botões, não <select> nativo de propósito: um <select> rouba o foco
          do editor de um jeito que a restauração de seleção do ProseMirror
          não recupera direito, embaralhando o texto ao continuar digitando
          logo depois de trocar o estilo do parágrafo. */}
      <ToolbarButton
        label="Parágrafo"
        active={
          !editor.isActive("heading", { level: 1 }) &&
          !editor.isActive("heading", { level: 2 }) &&
          !editor.isActive("heading", { level: 3 })
        }
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <span className="text-xs font-semibold">P</span>
      </ToolbarButton>
      <ToolbarButton
        label="Título 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
      >
        <span className="text-xs font-semibold">H1</span>
      </ToolbarButton>
      <ToolbarButton
        label="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
      >
        <span className="text-xs font-semibold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        label="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}
      >
        <span className="text-xs font-semibold">H3</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Sublinhado"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Alinhar à esquerda"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Centralizar"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Alinhar à direita"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Lista com marcadores"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Citação"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

/**
 * Editor de texto rico (negrito, títulos, listas, alinhamento) usado para
 * escrever modelos de documento — visual de "página" (folha branca com
 * margens) independente do tema do app, porque é assim que o documento vai
 * sair impresso de qualquer forma.
 */
export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  { content: string; onChange: (html: string) => void }
>(function RichTextEditor({ content, onChange }, ref) {
  // Congela o valor inicial: o TipTap resincroniza suas opções a cada
  // render, e reencaminhar o "content" vivo (que muda a cada tecla, via
  // onChange -> estado do pai -> nova prop) faria o editor reconstruir o
  // documento inteiro a partir do HTML a cada letra digitada, corrompendo a
  // edição em andamento (seleção perdida, texto sumindo). Pra carregar um
  // conteúdo novo depois de montado, o componente pai troca a "key" (ver
  // patient-documents-tab.tsx) em vez de mudar essa prop no lugar.
  const [initialContent] = useState(content);
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: EDITOR_PROPS,
  });

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      editor?.chain().focus().insertContent(text).run();
    },
  }));

  if (!editor) {
    return (
      <div className="h-[420px] animate-pulse rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <Toolbar editor={editor} />
      <div className="max-h-[50vh] overflow-y-auto bg-zinc-200 p-6 dark:bg-zinc-950">
        <div className="mx-auto max-w-[720px] rounded-sm bg-white shadow-md">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});
