import { montarLembrete } from "./templates";
import { enviarEmail } from "./email";
import { enviarWebhook } from "./webhook";
import type { Canal, LembretePayload, ResultadoEnvio } from "./types";

/**
 * Ponto único de envio, por trás do qual os canais concretos (email.ts,
 * webhook.ts) ficam escondidos — o despachante (dispatch/route.ts) só
 * conhece esta função, nunca decide sozinho como montar/enviar cada canal.
 * Novo canal (ex.: WhatsApp direto via Cloud API) entra aqui, sem tocar no
 * despachante.
 */
export async function enviarMensagem(
  canal: Canal,
  destino: string,
  payload: LembretePayload
): Promise<ResultadoEnvio> {
  if (canal === "email") {
    return enviarEmail(destino, montarLembrete(payload));
  }
  return enviarWebhook(destino, payload);
}
