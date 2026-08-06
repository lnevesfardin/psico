import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Catálogo fechado de hábitos. É o psicólogo quem escolhe quais valem para
 * cada paciente (ver habitos_paciente no schema.sql) — "tomou a medicação"
 * para quem não usa medicação viraria falso "não aderiu" no gráfico.
 * As chaves espelham o check constraint da tabela.
 */
export type HabitoChave =
  | "sono"
  | "medicacao"
  | "exercicio"
  | "alimentacao"
  | "agua"
  | "meditacao"
  | "social"
  | "sem_alcool";

export const HABITOS: {
  chave: HabitoChave;
  label: string;
  emoji: string;
}[] = [
  { chave: "sono", label: "Dormiu 7h ou mais", emoji: "😴" },
  { chave: "medicacao", label: "Tomou a medicação", emoji: "💊" },
  { chave: "exercicio", label: "Fez exercício ou caminhada", emoji: "🏃" },
  { chave: "alimentacao", label: "Alimentou-se bem", emoji: "🍎" },
  { chave: "agua", label: "Bebeu água suficiente", emoji: "💧" },
  { chave: "meditacao", label: "Meditou ou fez respiração", emoji: "🧘" },
  { chave: "social", label: "Teve contato social", emoji: "👥" },
  { chave: "sem_alcool", label: "Ficou sem álcool", emoji: "🚫" },
];

export function habitoLabel(chave: string): string {
  return HABITOS.find((h) => h.chave === chave)?.label ?? chave;
}

export function habitoEmoji(chave: string): string {
  return HABITOS.find((h) => h.chave === chave)?.emoji ?? "•";
}

export type RegistroHabito = {
  data: string; // yyyy-mm-dd
  chave: HabitoChave;
  feito: boolean;
};

/** Hábitos que o psicólogo ativou para um paciente. */
export async function listHabitosDoPaciente(
  supabase: SupabaseClient,
  pacienteId: string
): Promise<HabitoChave[]> {
  const { data, error } = await supabase
    .from("habitos_paciente")
    .select("chave")
    .eq("paciente_id", pacienteId);
  if (error) throw new Error(error.message);
  const ativos = new Set((data as { chave: string }[]).map((r) => r.chave));
  // Ordena pelo catálogo (e não pela ordem de inserção) pra lista ficar
  // sempre igual, independente de quando cada hábito foi ligado.
  return HABITOS.filter((h) => ativos.has(h.chave)).map((h) => h.chave);
}

/**
 * Hábitos do paciente logado. Sem filtro por paciente_id: o cliente não
 * conhece o próprio id na tabela "pacientes", e a policy
 * cliente_le_proprios_habitos já limita ao registro dele.
 */
export async function listMeusHabitos(
  supabase: SupabaseClient
): Promise<HabitoChave[]> {
  const { data, error } = await supabase
    .from("habitos_paciente")
    .select("chave");
  if (error) throw new Error(error.message);
  const ativos = new Set((data as { chave: string }[]).map((r) => r.chave));
  return HABITOS.filter((h) => ativos.has(h.chave)).map((h) => h.chave);
}

/** Substitui a seleção inteira de hábitos do paciente. */
export async function setHabitosDoPaciente(
  supabase: SupabaseClient,
  pacienteId: string,
  chaves: HabitoChave[]
): Promise<void> {
  const { error: delError } = await supabase
    .from("habitos_paciente")
    .delete()
    .eq("paciente_id", pacienteId);
  if (delError) throw new Error(delError.message);

  if (chaves.length === 0) return;
  const { error } = await supabase
    .from("habitos_paciente")
    .insert(chaves.map((chave) => ({ paciente_id: pacienteId, chave })));
  if (error) throw new Error(error.message);
}

/**
 * Registros diários de um cliente. Usada tanto pelo paciente (clienteId =
 * próprio auth.uid()) quanto pelo psicólogo (clienteId =
 * patient.clienteUserId) — a RLS decide o que cada um enxerga.
 */
export async function listRegistrosHabito(
  supabase: SupabaseClient,
  clienteId: string,
  desdeIso: string
): Promise<RegistroHabito[]> {
  const { data, error } = await supabase
    .from("registros_habito")
    .select("data, chave, feito")
    .eq("cliente_id", clienteId)
    .gte("data", desdeIso)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return data as RegistroHabito[];
}

export async function marcarHabito(
  supabase: SupabaseClient,
  clienteId: string,
  data: string,
  chave: HabitoChave,
  feito: boolean
): Promise<void> {
  const { error } = await supabase
    .from("registros_habito")
    .upsert(
      { cliente_id: clienteId, data, chave, feito },
      { onConflict: "cliente_id,data,chave" }
    );
  if (error) throw new Error(error.message);
}

/** % de dias com o hábito marcado, por hábito, no período carregado. */
export function calcularAdesao(
  registros: RegistroHabito[],
  chaves: HabitoChave[]
): { chave: HabitoChave; feitos: number; dias: number; pct: number }[] {
  return chaves.map((chave) => {
    const doHabito = registros.filter((r) => r.chave === chave);
    const feitos = doHabito.filter((r) => r.feito).length;
    // Denominador é o nº de dias em que a pessoa registrou algo daquele
    // hábito — não o período inteiro: dia sem registro é "não respondeu",
    // não "não fez", e contá-lo como falha inventaria uma queda de adesão.
    const dias = doHabito.length;
    return {
      chave,
      feitos,
      dias,
      pct: dias === 0 ? 0 : Math.round((feitos / dias) * 100),
    };
  });
}
