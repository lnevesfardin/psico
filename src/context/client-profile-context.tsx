"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { defaultClientProfile, type ClientProfile } from "@/lib/client-profile-data";

type ProfileRow = {
  name: string;
  cpf: string | null;
  bio: string | null;
  whatsapp: string | null;
};

function rowToClientProfile(row: ProfileRow): ClientProfile {
  return {
    name: row.name,
    cpf: row.cpf ?? "",
    bio: row.bio ?? "",
    whatsapp: row.whatsapp ?? "",
  };
}

type ClientProfileContextValue = {
  profile: ClientProfile;
  loading: boolean;
  updateProfile: (updates: Partial<ClientProfile>) => Promise<void>;
};

const ClientProfileContext = createContext<ClientProfileContextValue | null>(null);

export function ClientProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ClientProfile>(defaultClientProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("name, cpf, bio, whatsapp")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(rowToClientProfile(data as ProfileRow));
        setLoading(false);
      });
  }, [user]);

  async function updateProfile(updates: Partial<ClientProfile>) {
    if (!user) return;
    const supabase = createClient();

    // Lista explícita de colunas: nunca gravar o objeto inteiro, já que
    // "profiles" também guarda email/role/created_at (ver mesmo comentário
    // em profile-context.tsx) — e "role" é travado por trigger no banco.
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.cpf !== undefined) patch.cpf = updates.cpf;
    if (updates.bio !== undefined) patch.bio = updates.bio;
    if (updates.whatsapp !== undefined) patch.whatsapp = updates.whatsapp;

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id);

    if (error) throw new Error(error.message);
    setProfile((prev) => ({ ...prev, ...updates }));
  }

  return (
    <ClientProfileContext.Provider value={{ profile, loading, updateProfile }}>
      {children}
    </ClientProfileContext.Provider>
  );
}

export function useClientProfile(): ClientProfileContextValue {
  const ctx = useContext(ClientProfileContext);
  if (!ctx) {
    throw new Error("useClientProfile deve ser usado dentro de ClientProfileProvider");
  }
  return ctx;
}
