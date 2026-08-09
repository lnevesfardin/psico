import type { SupabaseClient } from "@supabase/supabase-js";
import type { PacoteSessao } from "@/lib/dashboard-data";

type PacoteRow = {
  id: string;
  paciente_id: string;
  quantidade_sessoes: number;
  sessoes_usadas: number;
  valor_total: number;
  validade: string | null;
};

const COLUMNS = "id, paciente_id, quantidade_sessoes, sessoes_usadas, valor_total, validade";

function rowToPacote(row: PacoteRow, patientName: string): PacoteSessao {
  return {
    id: row.id,
    patientId: row.paciente_id,
    patientName,
    quantidadeSessoes: row.quantidade_sessoes,
    sessoesUsadas: row.sessoes_usadas,
    valorTotal: row.valor_total,
    validade: row.validade,
  };
}

export function pacoteAtivo(p: PacoteSessao, hoje: string): boolean {
  return p.sessoesUsadas < p.quantidadeSessoes && (!p.validade || p.validade >= hoje);
}

export async function listPacotesByPatient(
  supabase: SupabaseClient,
  patientId: string,
  patientName: string
): Promise<PacoteSessao[]> {
  const { data, error } = await supabase
    .from("pacotes_sessao")
    .select(COLUMNS)
    .eq("paciente_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as PacoteRow[]).map((row) => rowToPacote(row, patientName));
}

// Todos os pacotes do psicólogo com sessão sobrando — usado pelo atalho da
// Agenda pra saber, sem uma query por paciente, se existe pacote ativo.
export async function listPacotesAtivos(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<PacoteSessao[]> {
  const { data, error } = await supabase
    .from("pacotes_sessao")
    .select(`${COLUMNS}, pacientes(nome)`)
    .eq("psicologo_id", psicologoId);
  if (error) throw new Error(error.message);
  const hoje = new Date().toISOString().slice(0, 10);
  return (data as (PacoteRow & { pacientes: { nome: string }[] })[])
    .map((row) => rowToPacote(row, row.pacientes[0]?.nome ?? ""))
    .filter((p) => pacoteAtivo(p, hoje));
}

export type NewPacoteInput = {
  patientId: string;
  quantidadeSessoes: number;
  valorTotal: number;
  validade: string | null;
};

export async function createPacote(
  supabase: SupabaseClient,
  psicologoId: string,
  patientName: string,
  input: NewPacoteInput
): Promise<PacoteSessao> {
  const { data, error } = await supabase
    .from("pacotes_sessao")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      quantidade_sessoes: input.quantidadeSessoes,
      valor_total: input.valorTotal,
      validade: input.validade,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPacote(data as PacoteRow, patientName);
}

// Chamado pelo atalho da Agenda quando o psicólogo escolhe "consumir sessão
// do pacote" em vez de lançar uma cobrança avulsa. Não é automático — é
// sempre uma escolha explícita (mesmo motivo de lancamentos_financeiros
// nunca ser gerado sozinho ao marcar uma consulta como realizada).
export async function consumirSessaoPacote(
  supabase: SupabaseClient,
  pacoteId: string,
  sessoesUsadasAtual: number
): Promise<void> {
  const { error } = await supabase
    .from("pacotes_sessao")
    .update({ sessoes_usadas: sessoesUsadasAtual + 1 })
    .eq("id", pacoteId);
  if (error) throw new Error(error.message);
}
