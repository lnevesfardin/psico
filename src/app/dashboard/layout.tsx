import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/sidebar";
import { ChatAssistant } from "@/components/chat/assistant";
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/auth/role";
import { assinaturaEmDia, getAssinatura } from "@/lib/assinatura-client";
import { ProfileProvider } from "@/context/profile-context";
import { DisponibilidadeProvider } from "@/context/disponibilidade-context";
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

  const role = await fetchUserRole(supabase, user.id);

  // Sem linha/role ainda (ex.: conta criada antes desta mudança) mantém o
  // comportamento atual em vez de trancar psicólogos existentes fora.
  if (role === "client") {
    redirect("/agendamentos");
  }

  // Perfil + disponibilidade são obrigatórios antes de usar o painel: sem
  // nenhum bloco de disponibilidade cadastrado, manda pro onboarding em vez
  // de liberar uma Agenda/link público vazios. Cobre tanto quem acabou de
  // escolher "Sou Psicólogo" quanto contas antigas que nunca configuraram.
  const { count } = await supabase
    .from("disponibilidades")
    .select("id", { count: "exact", head: true })
    .eq("psicologo_id", user.id);

  if (!count) {
    redirect("/onboarding");
  }

  // Só decide se MOSTRA o aviso — quem realmente barra a escrita é a RLS
  // (assinatura_ativa() no schema.sql). Não redireciona: o combinado é que
  // leitura/exportação do prontuário continuem acessíveis mesmo inadimplente.
  const emDia = assinaturaEmDia(await getAssinatura(supabase, user.id));

  return (
    <ProfileProvider>
      <DisponibilidadeProvider>
        <AppointmentsProvider>
          <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-x-hidden">
              {!emDia && <SubscriptionBanner />}
              {children}
            </main>
          </div>
          <ChatAssistant role="psychologist" />
        </AppointmentsProvider>
      </DisponibilidadeProvider>
    </ProfileProvider>
  );
}
