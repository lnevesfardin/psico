import type { Mensagem } from "./templates";
import type { ResultadoEnvio } from "./types";

/** Sem chave/remetente configurados, o despachante nem enfileira e-mails. */
export function emailConfigurado(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL);
}

/**
 * Envio via Brevo (ex-Sendinblue). Escolhido no lugar do Resend porque
 * aceita remetente verificado por endereço avulso — não exige domínio
 * próprio, que o projeto ainda não tem.
 *
 * Usa fetch direto em vez do SDK: é um único POST e o projeto mantém poucas
 * dependências de propósito.
 */
export async function enviarEmail(
  para: string,
  mensagem: Mensagem
): Promise<ResultadoEnvio> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "Psi Rob";

  if (!apiKey || !fromEmail) {
    return {
      ok: false,
      erro: "BREVO_API_KEY/BREVO_FROM_EMAIL não configuradas.",
    };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: para }],
        subject: mensagem.assunto,
        htmlContent: mensagem.html,
        textContent: mensagem.texto,
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      return { ok: false, erro: `Brevo ${res.status}: ${detalhe.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha de rede ao chamar a Brevo.",
    };
  }
}
