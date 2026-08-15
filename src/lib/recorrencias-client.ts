import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModalidadeAtendimento } from "@/lib/dashboard-data";

export async function deactivateRecorrencia(
  supabase: SupabaseClient,
  recorrenciaId: string
): Promise<void> {
  const { error } = await supabase
    .from("recorrencias")
    .update({ ativa: false })
    .eq("id", recorrenciaId);
  if (error) throw new Error(error.message);
}

// Datas (yyyy-mm-dd) em que a recorrência cai, a partir de `inicio`,
// respeitando dia_semana e intervalo_semanas, limitado a `maxOcorrencias`
// (ou até `fim`, o que vier primeiro). Não gera pra trás no tempo.
export function proximasDatas(
  inicio: string,
  diaSemana: number,
  intervaloSemanas: 1 | 2,
  maxOcorrencias: number,
  fim?: string | null
): string[] {
  const [y, m, d] = inicio.split("-").map(Number);
  const cursor = new Date(y, m - 1, d);
  // Avança até cair no dia da semana certo.
  while (cursor.getDay() !== diaSemana) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const datas: string[] = [];
  const limite = fim ? new Date(fim + "T23:59:59") : null;
  while (datas.length < maxOcorrencias) {
    if (limite && cursor > limite) break;
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    datas.push(iso);
    cursor.setDate(cursor.getDate() + 7 * intervaloSemanas);
  }
  return datas;
}

export type NovaRecorrenciaInput = {
  patientId: string;
  patientName: string;
  diaSemana: number;
  horario: string;
  modalidade: ModalidadeAtendimento | null;
  intervaloSemanas: 1 | 2;
  inicio: string;
  fim: string | null;
  // Quantas ocorrências gerar de imediato — o resto do horizonte é criado
  // sob demanda (o psicólogo continua vendo "próxima semana vazia" até
  // chegar perto da data, o que é aceitável: a série não desaparece, só a
  // agenda não vem pré-preenchida a perder de vista).
  maxOcorrenciasIniciais: number;
};

export async function createRecorrenciaComOcorrencias(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NovaRecorrenciaInput
): Promise<{ recorrenciaId: string; criadas: number; conflitos: number }> {
  const { data: recorrencia, error } = await supabase
    .from("recorrencias")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      dia_semana: input.diaSemana,
      horario: input.horario,
      modalidade: input.modalidade,
      intervalo_semanas: input.intervaloSemanas,
      inicio: input.inicio,
      fim: input.fim,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const datas = proximasDatas(
    input.inicio,
    input.diaSemana,
    input.intervaloSemanas,
    input.maxOcorrenciasIniciais,
    input.fim
  );

  let criadas = 0;
  let conflitos = 0;
  // Insert um a um (não em lote): um horário já ocupado não pode derrubar
  // a criação das outras ocorrências da série (constraint de exclusão é
  // por linha, um insert em lote falharia inteiro no primeiro conflito).
  for (const data of datas) {
    const { error: insertError } = await supabase.from("consultas").insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      paciente_nome: input.patientName,
      recorrencia_id: recorrencia.id,
      data,
      horario: input.horario,
      status: "confirmada",
      tipo: "consulta",
      origem: "manual",
      modalidade: input.modalidade,
    });
    if (insertError) conflitos += 1;
    else criadas += 1;
  }

  return { recorrenciaId: recorrencia.id as string, criadas, conflitos };
}

export type ConverterEmRecorrenteInput = {
  patientId: string;
  patientName: string;
  // Data/horário da consulta AVULSA já existente que está virando a
  // primeira ocorrência da série — nunca recriada, só linkada (ver
  // handleTornarRecorrente em agenda/page.tsx, que faz o update do
  // recorrencia_id nela depois de chamar esta função).
  data: string;
  horario: string;
  modalidade: ModalidadeAtendimento | null;
  intervaloSemanas: 1 | 2;
  fim: string | null;
  maxOcorrenciasIniciais: number;
};

// Cria a recorrência a partir de uma consulta avulsa que já existe na
// agenda (dia da semana derivado da própria data dela) e gera só as
// ocorrências FUTURAS — a primeira (a consulta original) não é recriada
// aqui, só teve o dia_semana/horário usados pra calcular o resto da série.
export async function converterEmRecorrente(
  supabase: SupabaseClient,
  psicologoId: string,
  input: ConverterEmRecorrenteInput
): Promise<{ recorrenciaId: string; criadas: number; conflitos: number }> {
  const [y, m, d] = input.data.split("-").map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay();

  const { data: recorrencia, error } = await supabase
    .from("recorrencias")
    .insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      dia_semana: diaSemana,
      horario: input.horario,
      modalidade: input.modalidade,
      intervalo_semanas: input.intervaloSemanas,
      inicio: input.data,
      fim: input.fim,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // +1 pra compensar o slice(1): a primeira data que proximasDatas() devolve
  // é sempre a própria "inicio" (a consulta original), que descartamos aqui.
  const datas = proximasDatas(
    input.data,
    diaSemana,
    input.intervaloSemanas,
    input.maxOcorrenciasIniciais + 1,
    input.fim
  ).slice(1);

  let criadas = 0;
  let conflitos = 0;
  for (const data of datas) {
    const { error: insertError } = await supabase.from("consultas").insert({
      psicologo_id: psicologoId,
      paciente_id: input.patientId,
      paciente_nome: input.patientName,
      recorrencia_id: recorrencia.id,
      data,
      horario: input.horario,
      status: "confirmada",
      tipo: "consulta",
      origem: "manual",
      modalidade: input.modalidade,
    });
    if (insertError) conflitos += 1;
    else criadas += 1;
  }

  return { recorrenciaId: recorrencia.id as string, criadas, conflitos };
}
