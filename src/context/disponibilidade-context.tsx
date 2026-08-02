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
import type { DisponibilidadeBlock, Modalidade } from "@/lib/disponibilidade-data";

type DisponibilidadeRow = {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  modalidade: Modalidade;
};

function rowToBlock(row: DisponibilidadeRow): DisponibilidadeBlock {
  return {
    id: row.id,
    diaSemana: row.dia_semana,
    startTime: row.horario_inicio.slice(0, 5),
    endTime: row.horario_fim.slice(0, 5),
    modalidade: row.modalidade,
  };
}

type DisponibilidadeContextValue = {
  blocks: DisponibilidadeBlock[];
  loading: boolean;
  addBlocks: (
    dias: number[],
    startTime: string,
    endTime: string,
    modalidade: Modalidade
  ) => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
};

const DisponibilidadeContext = createContext<DisponibilidadeContextValue | null>(
  null
);

const SELECT_COLUMNS = "id, dia_semana, horario_inicio, horario_fim, modalidade";

export function DisponibilidadeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<DisponibilidadeBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("disponibilidades")
      .select(SELECT_COLUMNS)
      .eq("psicologo_id", user.id)
      .order("dia_semana")
      .order("horario_inicio")
      .then(({ data }) => {
        if (data) setBlocks((data as DisponibilidadeRow[]).map(rowToBlock));
        setLoading(false);
      });
  }, [user]);

  async function addBlocks(
    dias: number[],
    startTime: string,
    endTime: string,
    modalidade: Modalidade
  ) {
    if (!user || dias.length === 0) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("disponibilidades")
      .insert(
        dias.map((dia) => ({
          psicologo_id: user.id,
          dia_semana: dia,
          horario_inicio: startTime,
          horario_fim: endTime,
          modalidade,
        }))
      )
      .select(SELECT_COLUMNS);

    if (error) throw new Error(error.message);
    const novos = (data as DisponibilidadeRow[]).map(rowToBlock);
    setBlocks((prev) =>
      [...prev, ...novos].sort(
        (a, b) => a.diaSemana - b.diaSemana || a.startTime.localeCompare(b.startTime)
      )
    );
  }

  async function removeBlock(id: string) {
    if (!user) return;
    const supabase = createClient();

    const { error } = await supabase
      .from("disponibilidades")
      .delete()
      .eq("id", id)
      .eq("psicologo_id", user.id);

    if (error) throw new Error(error.message);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <DisponibilidadeContext.Provider
      value={{ blocks, loading, addBlocks, removeBlock }}
    >
      {children}
    </DisponibilidadeContext.Provider>
  );
}

export function useDisponibilidade(): DisponibilidadeContextValue {
  const ctx = useContext(DisponibilidadeContext);
  if (!ctx) {
    throw new Error(
      "useDisponibilidade deve ser usado dentro de DisponibilidadeProvider"
    );
  }
  return ctx;
}
