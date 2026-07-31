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
  crp_uf: string | null;
  crp_status: "pendente" | "verificado";
  crp_documento_path: string | null;
  cpf: string | null;
  foto_url: string | null;
  bio: string | null;
  valor_consulta: number;
  whatsapp: string | null;
};

function rowToProfile(row: ProfileRow): Profile {
  return {
    name: row.nome,
    title: row.titulo,
    crp: row.crp,
    crpUf: row.crp_uf ?? "",
    crpStatus: row.crp_status,
    crpDocumentoPath: row.crp_documento_path ?? "",
    cpf: row.cpf ?? "",
    photoUrl: row.foto_url ?? "",
    bio: row.bio ?? "",
    price: row.valor_consulta,
    whatsapp: row.whatsapp ?? "",
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
        "nome, titulo, crp, crp_uf, crp_status, crp_documento_path, cpf, foto_url, bio, valor_consulta, whatsapp"
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
    if (updates.crpUf !== undefined) patch.crp_uf = updates.crpUf;
    if (updates.crpDocumentoPath !== undefined)
      patch.crp_documento_path = updates.crpDocumentoPath;
    if (updates.cpf !== undefined) patch.cpf = updates.cpf;
    // crpStatus nunca entra no patch: é definido por quem revisa o
    // documento, não pelo próprio psicólogo (a RLS de "perfis" permite
    // update de qualquer coluna própria, então a restrição é só aqui na
    // aplicação — não há verificação automática hoje).
    if (updates.photoUrl !== undefined) patch.foto_url = updates.photoUrl;
    if (updates.bio !== undefined) patch.bio = updates.bio;
    if (updates.price !== undefined) patch.valor_consulta = updates.price;
    if (updates.whatsapp !== undefined) patch.whatsapp = updates.whatsapp;

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
