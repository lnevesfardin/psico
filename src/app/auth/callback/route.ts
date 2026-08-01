import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathForRole, fetchUserRole } from "@/lib/auth/role";

// Único destino pós-código que não é "ir pro painel": o link de e-mail do
// "Esqueci minha senha" (supabase.auth.resetPasswordForEmail) passa por essa
// mesma rota. Whitelist explícita evita open redirect via ?next=.
const ALLOWED_NEXT_PATHS = new Set(["/auth/redefinir-senha"]);

// Erros do Supabase chegam em inglês; traduzimos os mais comuns e deixamos
// o restante passar como veio, pra continuar diagnosticável em vez de virar
// uma mensagem genérica (mesmo padrão adotado no erro do assistente/Gemini).
function traduzErroCallback(msg: string): string {
  if (msg.includes("Email link is invalid or has expired"))
    return "Link inválido ou expirado. Peça um novo.";
  if (msg.includes("Token has expired or is invalid"))
    return "Link inválido ou expirado. Peça um novo.";
  return msg;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(traduzErroCallback(errorDescription))}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (next && ALLOWED_NEXT_PATHS.has(next)) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const role = await fetchUserRole(supabase, data.user.id);
      // null só acontece no primeiro login via Google (não passou pelo
      // seletor "Sou Cliente / Sou Psicólogo" do formulário de cadastro).
      if (!role) {
        return NextResponse.redirect(`${origin}/auth/escolher-perfil`);
      }
      return NextResponse.redirect(`${origin}${dashboardPathForRole(role)}`);
    }

    // Erro real do Supabase (ex.: link de recuperação/confirmação expirado,
    // ou nonce inválido) — mais diagnosticável do que a mensagem genérica.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(traduzErroCallback(error.message))}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Não foi possível concluir o login.")}`
  );
}
