/**
 * Empacota HTML (saída do editor rico, ver rich-text-editor.tsx) como um
 * arquivo .doc que o Word/Google Docs abre preservando negrito, títulos,
 * listas etc. Truque conhecido: Word abre qualquer HTML bem formado se a
 * extensão for .doc — não precisa gerar um .docx binário de verdade nem
 * adicionar biblioteca nova. O <style> replica as mesmas regras de
 * .rich-doc (globals.css), porque o arquivo baixado não tem acesso ao CSS
 * do site.
 */
export function downloadAsWord(contentHtml: string, filename: string): void {
  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${filename}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; color: #000; }
  h1 { font-size: 18pt; font-weight: bold; margin: 20pt 0 10pt; }
  h2 { font-size: 15pt; font-weight: bold; margin: 18pt 0 8pt; }
  h3 { font-size: 13pt; font-weight: bold; margin: 16pt 0 6pt; }
  p { margin: 8pt 0; }
  ul, ol { margin: 8pt 0; padding-left: 24pt; }
  blockquote { margin: 10pt 0; padding-left: 14pt; border-left: 3px solid #ccc; color: #555; font-style: italic; }
  strong { font-weight: bold; }
  em { font-style: italic; }
</style>
</head>
<body>${contentHtml}</body>
</html>`;

  // BOM ("﻿") garante que o Word reconheça UTF-8 e acentuação não
  // quebre ao abrir.
  const blob = new Blob(["﻿", doc], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".doc") ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
