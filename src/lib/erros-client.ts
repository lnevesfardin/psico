import { createClient } from "@/lib/supabase/client";

/**
 * Manda o erro pra tabela erros_app (ver registrar_erro_app no schema.sql).
 *
 * Nunca lança: é chamada de dentro de catch e de handler global, onde uma
 * exceção só empilharia problema em cima de quem já está travado.
 */

/**
 * Assinaturas já enviadas nesta aba. Um erro dentro de render ou de um
 * setInterval repete a cada tick — sem isto, uma única tela quebrada enche a
 * tabela sozinha e ainda esconde os outros erros no meio do ruído.
 */
const jaEnviados = new Set<string>();
const TETO_POR_ABA = 10;

function assinatura(mensagem: string, rota: string): string {
  return `${rota}::${mensagem.slice(0, 200)}`;
}

export function reportarErro(
  erro: unknown,
  origem: "cliente" | "servidor" = "cliente"
): void {
  try {
    const mensagem =
      erro instanceof Error
        ? `${erro.name}: ${erro.message}`
        : String(erro ?? "erro desconhecido");
    if (!mensagem.trim()) return;

    const rota = typeof window === "undefined" ? "" : window.location.pathname;
    const chave = assinatura(mensagem, rota);
    if (jaEnviados.has(chave) || jaEnviados.size >= TETO_POR_ABA) return;
    jaEnviados.add(chave);

    void createClient()
      .rpc("registrar_erro_app", {
        p_origem: origem,
        p_rota: rota,
        p_mensagem: mensagem,
        p_stack: erro instanceof Error ? (erro.stack ?? null) : null,
        p_user_agent:
          typeof navigator === "undefined" ? null : navigator.userAgent,
      })
      .then(
        () => {},
        () => {}
      );
  } catch {
    // Falhar em registrar o erro não pode virar um erro.
  }
}
