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
import { defaultProfile, type Profile } from "@/lib/profile-data";

type ProfileRow = {
  nome: string;
  titulo: string;
  crp: string;
  uf: string;
  cidade: string;
  foto_url: string | null;
  bio: string | null;
  valor_consulta: number;
  whatsapp: string | null;
  especialidades: string[];
  abordagens: string[];
  faixas_etarias: string[];
};

function rowToProfile(row: ProfileRow): Profile {
  return {
    name: row.nome,
    title: row.titulo,
    crp: row.crp,
    uf: row.uf,
    cidade: row.cidade,
    photoUrl: row.foto_url ?? "",
    bio: row.bio ?? "",
    price: row.valor_consulta,
    whatsapp: row.whatsapp ?? "",
    especialidades: row.especialidades,
    abordagens: row.abordagens,
    faixasEtarias: row.faixas_etarias,
  };
}

type ProfileContextValue = {
  profile: Profile;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("perfis")
      .select(
        "nome, titulo, crp, uf, cidade, foto_url, bio, valor_consulta, whatsapp, especialidades, abordagens, faixas_etarias"
      )
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(rowToProfile(data as ProfileRow));
        setLoading(false);
      });
  }, [user]);

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return;
    const supabase = createClient();

    // Lista explícita de colunas: nunca gravar o objeto inteiro em cache,
    // já que "perfis" também guarda a disponibilidade (working-hours-context)
    // e um update largo aqui reverteria o que aquele contexto salvou.
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.nome = updates.name;
    if (updates.title !== undefined) patch.titulo = updates.title;
    if (updates.crp !== undefined) patch.crp = updates.crp;
    if (updates.uf !== undefined) patch.uf = updates.uf;
    if (updates.cidade !== undefined) patch.cidade = updates.cidade;
    if (updates.photoUrl !== undefined) patch.foto_url = updates.photoUrl;
    if (updates.bio !== undefined) patch.bio = updates.bio;
    if (updates.price !== undefined) patch.valor_consulta = updates.price;
    if (updates.whatsapp !== undefined) patch.whatsapp = updates.whatsapp;
    if (updates.especialidades !== undefined)
      patch.especialidades = updates.especialidades;
    if (updates.abordagens !== undefined) patch.abordagens = updates.abordagens;
    if (updates.faixasEtarias !== undefined)
      patch.faixas_etarias = updates.faixasEtarias;

    const { error } = await supabase
      .from("perfis")
      .update(patch)
      .eq("id", user.id);

    if (error) throw new Error(error.message);
    setProfile((prev) => ({ ...prev, ...updates }));
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile deve ser usado dentro de ProfileProvider");
  }
  return ctx;
}
