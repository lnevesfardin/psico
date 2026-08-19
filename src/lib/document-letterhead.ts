/**
 * Timbrado dos documentos: a logo do perfil aplicada no topo na hora de
 * imprimir ou baixar, e NÃO copiada para dentro do conteúdo salvo.
 *
 * A escolha é deliberada. Se a imagem fosse embutida no texto do documento,
 * cada linha de documentos_emitidos carregaria uma cópia da logo (a de upload
 * é data URL, isto é, a imagem inteira em base64), e trocar de logo exigiria
 * reeditar documento por documento. Mantendo no perfil, o documento salvo
 * continua sendo só o texto e a logo nova vale até para o que já foi emitido.
 */

/** Altura máxima do timbrado, em pontos — cabe no topo sem roubar a página. */
const ALTURA_MAX_PT = 64;

/**
 * Só http(s) e imagem em data URL entram no src. A logo vem do perfil do
 * próprio psicólogo, mas o valor é texto livre digitado no campo "URL da
 * logo", e daqui ele vai parar em HTML — sem esta trava, um `javascript:`
 * colado ali viraria um vetor a mais numa tela que exibe prontuário.
 */
function urlDeImagemSegura(url: string): string | null {
  const limpa = url.trim();
  if (!limpa) return null;
  if (/^https?:\/\//i.test(limpa)) return limpa;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(limpa)) return limpa;
  return null;
}

function escaparAtributo(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type ContatoTimbrado = {
  crp: string;
  whatsapp: string;
  email: string;
};

/** Cor do texto de contato: o mesmo verde-oliva da marca (--color-brand-600
 *  em globals.css) — este HTML não tem acesso à variável CSS, por isso o
 *  hex direto. */
const COR_CONTATO = "#5c7143";

/**
 * Devolve o HTML do cabeçalho, ou string vazia quando não há logo válida —
 * quem chama pode concatenar sem verificar nada.
 *
 * Nome do psicólogo fica DE FORA do texto de propósito: a logo real que os
 * psicólogos sobem costuma já trazer o próprio nome desenhado nela (foi o
 * caso de referência que motivou este recurso) — reimprimir o nome por
 * baixo duplicaria a informação. CRP, telefone e e-mail, por outro lado,
 * dificilmente estão dentro da imagem, então entram como texto.
 */
export function timbradoHtml(logoUrl: string, contato?: ContatoTimbrado): string {
  const src = urlDeImagemSegura(logoUrl);
  if (!src) return "";

  const linhasContato = contato
    ? [
        contato.crp.trim(),
        contato.whatsapp.trim() && `Cel: ${contato.whatsapp.trim()}`,
        contato.email.trim() && `Email: ${contato.email.trim()}`,
      ].filter((linha): linha is string => Boolean(linha))
    : [];

  const blocoContato = linhasContato.length
    ? `<div style="margin-top:8pt;font-size:9.5pt;color:${COR_CONTATO};line-height:1.7;">${linhasContato
        .map(escaparAtributo)
        .join("<br/>")}</div>`
    : "";

  // Estilos inline: este HTML também vai para o arquivo .doc, que não
  // enxerga o CSS do site nem classes do Tailwind.
  //
  // "display:block;margin:0 auto" em vez de só text-align no pai: o preflight
  // do Tailwind já deixa <img> como bloco, e aí o text-align do pai não
  // centraliza nada na prévia/impressão. Assim centraliza nos dois lados.
  return `<div style="text-align:center;margin:0 0 18pt;padding-bottom:14pt;border-bottom:1px solid #d4d4d8;"><img src="${escaparAtributo(
    src
  )}" alt="" style="display:block;margin:0 auto;max-height:${ALTURA_MAX_PT}pt;max-width:60%;" />${blocoContato}</div>`;
}

/**
 * Reduz a imagem escolhida no upload antes de virar data URL. Sem isso, a
 * foto de 3 MB do celular iria inteira para a coluna do perfil e viajaria em
 * toda carga de tela do painel, que lê o perfil no layout.
 */
export function reduzirImagemParaDataUrl(
  file: File,
  larguraMax = 600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const original = String(reader.result);

      // SVG não passa por canvas (vetor não tem pixel para redimensionar) e
      // já costuma ser pequeno: vai como veio.
      if (file.type === "image/svg+xml") {
        resolve(original);
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const escala = Math.min(1, larguraMax / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(original);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG preserva o fundo transparente que a maioria das logos tem.
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
