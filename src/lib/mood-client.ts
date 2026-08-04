import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso } from "@/lib/format";

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: "Muito Ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Ótimo",
};

export type MoodTag =
  | "sono"
  | "trabalho"
  | "alimentacao"
  | "exercicio"
  | "relacionamentos"
  | "saude";

export const MOOD_TAGS: { value: MoodTag; label: string; emoji: string }[] = [
  { value: "sono", label: "Sono", emoji: "💤" },
  { value: "trabalho", label: "Trabalho", emoji: "💼" },
  { value: "alimentacao", label: "Alimentação", emoji: "🍎" },
  { value: "exercicio", label: "Exercício", emoji: "🏋️" },
  { value: "relacionamentos", label: "Relacionamentos", emoji: "👥" },
  { value: "saude", label: "Saúde", emoji: "🩺" },
];

export type MoodCheckin = {
  id: string;
  date: string; // yyyy-mm-dd
  mood: MoodLevel;
  energy: MoodLevel;
  tags: MoodTag[];
  positiveNote: string;
  createdAt: string;
};

type CheckinRow = {
  id: string;
  data: string;
  humor: number;
  energia: number;
  tags: string[];
  reflexao_positiva: string | null;
  created_at: string;
};

const CHECKIN_COLUMNS = "id, data, humor, energia, tags, reflexao_positiva, created_at";

function rowToCheckin(row: CheckinRow): MoodCheckin {
  return {
    id: row.id,
    date: row.data,
    mood: row.humor as MoodLevel,
    energy: row.energia as MoodLevel,
    tags: row.tags as MoodTag[],
    positiveNote: row.reflexao_positiva ?? "",
    createdAt: row.created_at,
  };
}

// Usada tanto pelo cliente (clienteId = próprio auth.uid()) quanto pelo
// psicólogo (clienteId = patient.clienteUserId) — a RLS de checkins_humor
// decide o que cada um enxerga, a função de leitura é a mesma.
export async function listMoodCheckins(
  supabase: SupabaseClient,
  clienteId: string,
  limit = 400
): Promise<MoodCheckin[]> {
  const { data, error } = await supabase
    .from("checkins_humor")
    .select(CHECKIN_COLUMNS)
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as CheckinRow[]).map(rowToCheckin);
}

export type MoodCheckinInput = {
  mood: MoodLevel;
  energy: MoodLevel;
  tags: MoodTag[];
  positiveNote: string;
};

export async function upsertTodayCheckin(
  supabase: SupabaseClient,
  clienteId: string,
  input: MoodCheckinInput
): Promise<MoodCheckin> {
  const { data, error } = await supabase
    .from("checkins_humor")
    .upsert(
      {
        cliente_id: clienteId,
        data: todayIso(),
        humor: input.mood,
        energia: input.energy,
        tags: input.tags,
        reflexao_positiva: input.positiveNote.trim() || null,
      },
      { onConflict: "cliente_id,data" }
    )
    .select(CHECKIN_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToCheckin(data as CheckinRow);
}
