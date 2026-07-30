import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/sidebar";
import { createClient } from "@/lib/supabase/server";
import { ProfileProvider } from "@/context/profile-context";
import { WorkingHoursProvider } from "@/context/working-hours-context";
import { AppointmentsProvider } from "@/context/appointments-context";

export default async function DashboardLayout({
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

  // Sem linha/role ainda (ex.: conta criada antes desta mudança) mantém o
  // comportamento atual em vez de trancar psicólogos existentes fora.
  if (profile?.role === "client") {
    redirect("/agendamentos");
  }

  return (
    <ProfileProvider>
      <WorkingHoursProvider>
        <AppointmentsProvider>
          <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </AppointmentsProvider>
      </WorkingHoursProvider>
    </ProfileProvider>
  );
}
