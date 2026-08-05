import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/auth/role";
import { ClientAreaSidebar } from "@/components/client-area/sidebar";
import { ChatAssistant } from "@/components/chat/assistant";
import { ClientProfileProvider } from "@/context/client-profile-context";

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

  const role = await fetchUserRole(supabase, user.id);

  if (role === "psychologist") {
    redirect("/dashboard/agenda");
  }

  return (
    <ClientProfileProvider>
      <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
        <ClientAreaSidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
      <ChatAssistant role="client" />
    </ClientProfileProvider>
  );
}
