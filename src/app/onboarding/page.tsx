import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/auth/role";
import { OnboardingPsicologo } from "./onboarding-psicologo";
import { OnboardingCliente } from "./onboarding-cliente";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await fetchUserRole(supabase, user.id);

  if (role === "paciente") {
    return <OnboardingCliente />;
  }

  return <OnboardingPsicologo />;
}
