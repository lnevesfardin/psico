import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DASHBOARD_PATH, dashboardPathForRole, fetchUserRole } from "@/lib/auth/role";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() revalida o token contra o servidor Auth; getSession() apenas
  // leria o cookie sem confirmar que ainda é válido.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPsychologistArea = pathname.startsWith("/dashboard");
  const isClientArea = pathname.startsWith("/agendamentos");
  // Onboarding é o passo 3 do cadastro (ver StepIndicator) tanto pra
  // psicólogo quanto pra cliente — exige sessão como as demais áreas
  // protegidas, mas fica fora do guard de role abaixo: cada papel vê um
  // conteúdo diferente na própria página (onboarding-psicologo.tsx /
  // onboarding-cliente.tsx), sem bounce entre áreas aqui no middleware.
  const isOnboarding = pathname.startsWith("/onboarding");
  const isProtected = isPsychologistArea || isClientArea || isOnboarding;
  const isAuthPage = pathname === "/login" || pathname === "/cadastro";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Guard de role: impede um cliente de acessar /dashboard/* e um psicólogo
  // de acessar /agendamentos/*, e manda quem já está logado direto para o
  // painel certo ao visitar /login ou /cadastro — os layouts fazem a mesma
  // checagem como segundo cinto de segurança (RLS é a barreira real de dados).
  if (user && (isAuthPage || isPsychologistArea || isClientArea)) {
    const role = await fetchUserRole(supabase, user.id);

    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = dashboardPathForRole(role);
      return NextResponse.redirect(url);
    }

    if (isPsychologistArea && role === "client") {
      const url = request.nextUrl.clone();
      url.pathname = "/agendamentos";
      return NextResponse.redirect(url);
    }

    if (isClientArea && role === "psychologist") {
      const url = request.nextUrl.clone();
      url.pathname = DASHBOARD_PATH;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
