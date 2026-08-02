import type { Mensagem } from "./templates";
import type { ResultadoEnvio } from "./types";

/** Sem chave configurada, o despachante nem enfileira e-mails. */
export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Envio via Resend. Usa fetch direto em vez do SDK: a API é um único POST e
 * o projeto tem poucas dependências de propósito.
 */
export async function enviarEmail(
  para: string,
  mensagem: Mensagem
): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return { ok: false, erro: "RESEND_API_KEY/RESEND_FROM não configuradas." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [para],
        subject: mensagem.assunto,
        html: mensagem.html,
        text: mensagem.texto,
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      return { ok: false, erro: `Resend ${res.status}: ${detalhe.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha de rede ao chamar o Resend.",
    };
  }
}
