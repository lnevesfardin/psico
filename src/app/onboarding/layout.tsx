import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/auth/role";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O proxy.ts já bloqueia visitantes sem sessão antes de chegar aqui; esta
  // checagem é um segundo cinto de segurança (mesmo padrão de
  // dashboard/layout.tsx) — sem ela, a página em si (client component) ficaria
  // presa num spinner infinito pra quem chegasse aqui deslogado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await fetchUserRole(supabase, user.id);

  // Cliente não tem "conclusão" a verificar aqui: o passo 3 dele é só uma
  // tela de confirmação (ver onboarding-cliente.tsx), sempre pode revê-la.
  if (role === "client") {
    return children;
  }

  // Psicólogo já concluiu o onboarding antes: não faz sentido preencher de
  // novo (mesmo gate que manda de volta pra cá em dashboard/layout.tsx).
  const { count } = await supabase
    .from("disponibilidades")
    .select("id", { count: "exact", head: true })
    .eq("psicologo_id", user.id);

  if (count) {
    redirect("/dashboard/agenda");
  }

  return children;
}
