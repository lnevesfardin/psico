import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/role";

export type CurrentProfile = {
  id: string;
  orgId: string | null;
  role: Role | null;
  name: string;
  email: string;
};

/**
 * Server Component/Route Handler only. `cache()` do React garante uma única
 * query por request mesmo com várias chamadas (layout + página, por
 * exemplo) — não persiste entre requests diferentes.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("org_id, role, name, email")
    .eq("id", user.id)
    .single();
  if (!data) return null;

  return {
    id: user.id,
    orgId: data.org_id,
    role: data.role as Role | null,
    name: data.name,
    email: data.email,
  };
});
