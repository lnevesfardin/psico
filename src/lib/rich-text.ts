const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

/** Mesma detecção usada por ensureHtml: o conteúdo já é HTML ou é texto puro
 *  legado (anterior ao editor rico)? */
export function pareceHtml(conteudo: string): boolean {
  return HTML_TAG_RE.test(conteudo);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Converte texto puro (com quebras de linha "\n") em HTML equivalente, uma
 * linha por parágrafo — usado só para migrar conteúdo salvo antes do editor
 * rico (textarea simples) para dentro dele sem perder as quebras de linha.
 */
/**
 * Uma linha por parágrafo, para texto que JÁ foi escapado. Existe separada de
 * plainTextToHtml porque quem monta documento precisa escapar cada valor na
 * hora da substituição (ver fillPlaceholders) e não pode escapar de novo aqui.
 *
 * Linha vazia vira <p></p>, não <p><br></p>: um <br> literal no meio do
 * conteúdo (em vez do "trailing break" que o próprio editor desenha sozinho em
 * parágrafo vazio) fazia o ProseMirror produzir uma seleção inválida sempre
 * que o cursor ia pro início do documento (Home/Ctrl+A) antes de aplicar
 * negrito/título — resultado: o texto selecionado sumia ao aplicar a
 * formatação. <p></p> puro não tem esse problema.
 */
export function linhasParaParagrafos(textoJaEscapado: string): string {
  return textoJaEscapado
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function plainTextToHtml(text: string): string {
  return linhasParaParagrafos(escapeHtml(text));
}

/**
 * Modelos e documentos criados antes do editor rico têm "conteudo" em texto
 * puro; os criados depois já vêm em HTML (saída do TipTap). Esta função
 * aceita os dois e sempre devolve HTML — usada em todo lugar que carrega
 * "conteudo" para dentro do editor ou para impressão.
 */
export function ensureHtml(conteudo: string): string {
  return HTML_TAG_RE.test(conteudo) ? conteudo : plainTextToHtml(conteudo);
}
