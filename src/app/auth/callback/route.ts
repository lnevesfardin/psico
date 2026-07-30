import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathForRole, fetchUserRole } from "@/lib/auth/role";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const role = await fetchUserRole(supabase, data.user.id);
      // null só acontece no primeiro login via Google (não passou pelo
      // seletor "Sou Cliente / Sou Psicólogo" do formulário de cadastro).
      if (!role) {
        return NextResponse.redirect(`${origin}/auth/escolher-perfil`);
      }
      return NextResponse.redirect(`${origin}${dashboardPathForRole(role)}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Não foi possível concluir o login.")}`
  );
}
