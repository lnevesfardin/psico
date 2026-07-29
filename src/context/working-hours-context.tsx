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
import { defaultWorkingHours, type WorkingHours } from "@/lib/working-hours-data";

type WorkingHoursRow = {
  dias_disponiveis: number[];
  horario_inicio: string;
  horario_fim: string;
};

function rowToWorkingHours(row: WorkingHoursRow): WorkingHours {
  return {
    days: row.dias_disponiveis,
    startTime: row.horario_inicio.slice(0, 5),
    endTime: row.horario_fim.slice(0, 5),
  };
}

type WorkingHoursContextValue = {
  workingHours: WorkingHours;
  loading: boolean;
  updateWorkingHours: (next: WorkingHours) => Promise<void>;
};

const WorkingHoursContext = createContext<WorkingHoursContextValue | null>(
  null
);

export function WorkingHoursProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workingHours, setWorkingHours] = useState<WorkingHours>(
    defaultWorkingHours
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("perfis")
      .select("dias_disponiveis, horario_inicio, horario_fim")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setWorkingHours(rowToWorkingHours(data as WorkingHoursRow));
        setLoading(false);
      });
  }, [user]);

  async function updateWorkingHours(next: WorkingHours) {
    if (!user) return;
    const supabase = createClient();

    // Lista explícita de colunas — ver o mesmo comentário em profile-context.tsx.
    const { error } = await supabase
      .from("perfis")
      .update({
        dias_disponiveis: next.days,
        horario_inicio: next.startTime,
        horario_fim: next.endTime,
      })
      .eq("id", user.id);

    if (error) throw new Error(error.message);
    setWorkingHours(next);
  }

  return (
    <WorkingHoursContext.Provider
      value={{ workingHours, loading, updateWorkingHours }}
    >
      {children}
    </WorkingHoursContext.Provider>
  );
}

export function useWorkingHours(): WorkingHoursContextValue {
  const ctx = useContext(WorkingHoursContext);
  if (!ctx) {
    throw new Error(
      "useWorkingHours deve ser usado dentro de WorkingHoursProvider"
    );
  }
  return ctx;
}
