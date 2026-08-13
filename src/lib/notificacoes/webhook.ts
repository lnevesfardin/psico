import { createHmac } from "node:crypto";
import type { LembretePayload, ResultadoEnvio } from "./types";

export function webhookConfigurado(): boolean {
  return Boolean(process.env.NOTIFICACOES_WEBHOOK_URL);
}

export function webhookUrl(): string {
  return process.env.NOTIFICACOES_WEBHOOK_URL ?? "";
}

/**
 * POST do lembrete num endpoint externo (Zapier/n8n/Make), para o destino
 * decidir o que fazer — WhatsApp, SMS, planilha etc.
 *
 * Quando NOTIFICACOES_WEBHOOK_SECRET está definida, assina o corpo com
 * HMAC-SHA256 em "X-Psico-Signature" para o destino confirmar que a
 * chamada veio mesmo daqui.
 */
export async function enviarWebhook(
  url: string,
  payload: LembretePayload
): Promise<ResultadoEnvio> {
  const corpo = JSON.stringify(payload);
  const secret = process.env.NOTIFICACOES_WEBHOOK_SECRET;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    headers["X-Psico-Signature"] = createHmac("sha256", secret)
      .update(corpo)
      .digest("hex");
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body: corpo });
    if (!res.ok) {
      const detalhe = await res.text();
      return { ok: false, erro: `Webhook ${res.status}: ${detalhe.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha de rede ao chamar o webhook.",
    };
  }
}
