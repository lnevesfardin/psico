import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * O @supabase/ssr sempre grava o cookie de sessão com 400 dias de validade —
 * a lib ignora qualquer cookieOptions.maxAge customizado na escrita e força
 * o próprio padrão (ver DEFAULT_COOKIE_OPTIONS/setCookieOptions no pacote).
 * Não dá pra pedir "sessão só deste acesso" na criação do client.
 *
 * Pra oferecer "manter conectado" desmarcado, chame isto logo depois de um
 * login bem-sucedido: reescreve o(s) cookie(s) sb-*-auth-token com o mesmo
 * valor, mas sem maxAge/expires — vira cookie de sessão do navegador,
 * apagado ao fechar todas as janelas, em vez de durar 400 dias.
 */
export function tornarSessaoTemporaria() {
  if (typeof document === "undefined") return;
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie
    .split(";")
    .map((par) => par.trim())
    .filter((par) => /^sb-.*-auth-token/.test(par.split("=")[0]))
    .forEach((par) => {
      const igual = par.indexOf("=");
      const nome = par.slice(0, igual);
      const valor = par.slice(igual + 1);
      document.cookie = `${nome}=${valor}; path=/; SameSite=Lax${seguro}`;
    });
}
