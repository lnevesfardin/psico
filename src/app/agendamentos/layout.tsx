import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AgendamentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O proxy.ts já bloqueia visitantes sem sessão antes de chegar aqui; esta
  // checagem é um segundo cinto de segurança (RLS é a barreira real de dados).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "psychologist") {
    redirect("/dashboard/agenda");
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {children}
    </div>
  );
}
