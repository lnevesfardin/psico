import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Adendo,
  FormatoEvolucao,
  Patient,
  PatientAddress,
  PatientStatus,
  SessionNote,
  StatusEvolucao,
} from "@/lib/dashboard-data";

type SessaoRow = {
  id: string;
  conteudo: string;
  data_hora: string;
  origem: SessionNote["origem"];
  formato: FormatoEvolucao;
  status: StatusEvolucao;
  assinado_em: string | null;
  agendamento_id: string | null;
  gerado_por_ia: boolean;
};

const SESSAO_COLUMNS =
  "id, conteudo, data_hora, origem, formato, status, assinado_em, agendamento_id, gerado_por_ia";

function rowToSessionNote(row: SessaoRow, adendos: Adendo[] = []): SessionNote {
  return {
    id: row.id,
    content: row.conteudo,
    dateTime: row.data_hora,
    origem: row.origem ?? "manual",
    formato: row.formato ?? "livre",
    status: row.status ?? "rascunho",
    assinadoEm: row.assinado_em,
    agendamentoId: row.agendamento_id,
    geradoPorIa: row.gerado_por_ia ?? false,
    adendos,
  };
}

type AdendoRow = {
  id: string;
  evolucao_id: string;
  texto: string;
  motivo: string | null;
  created_at: string;
};

function rowToAdendo(row: AdendoRow): Adendo {
  return {
    id: row.id,
    evolucaoId: row.evolucao_id,
    texto: row.texto,
    motivo: row.motivo,
    createdAt: row.created_at,
  };
}

type PacienteRow = {
  id: string;
  nome: string;
  nome_social: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  genero: string | null;
  endereco: PatientAddress | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_parentesco: string | null;
  tem_plano_saude: boolean;
  plano_saude_nome: string | null;
  data_primeira_consulta: string | null;
  escolaridade: string | null;
  como_conheceu: string | null;
  queixa_inicial: string | null;
  encaminhado_por: string | null;
  valor_sessao: number | null;
  frequencia_padrao: string | null;
  observacoes: string | null;
  status: PatientStatus;
  arquivado_em: string | null;
  cliente_user_id: string | null;
};

const PACIENTE_COLUMNS =
  "id, nome, nome_social, cpf, telefone, email, data_nascimento, genero, endereco, contato_emergencia_nome, contato_emergencia_telefone, responsavel_nome, responsavel_cpf, responsavel_parentesco, tem_plano_saude, plano_saude_nome, data_primeira_consulta, escolaridade, como_conheceu, queixa_inicial, encaminhado_por, valor_sessao, frequencia_padrao, observacoes, status, arquivado_em, cliente_user_id";

// Idade em anos completos, calculada a partir de yyyy-mm-dd. Fica em duas
// funções separadas (idade / isMinor) porque a tela também mostra "17 anos"
// em vez de só um booleano.
export function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

export function isMinor(birthDate: string): boolean {
  const age = ageFromBirthDate(birthDate);
  return age !== null && age < 18;
}

function rowToPatient(row: PacienteRow, sessions: SessionNote[] = []): Patient {
  return {
    id: row.id,
    name: row.nome,
    nomeSocial: row.nome_social ?? "",
    cpf: row.cpf ?? "",
    phone: row.telefone ?? "",
    email: row.email ?? "",
    birthDate: row.data_nascimento ?? "",
    genero: row.genero ?? "",
    endereco: row.endereco ?? null,
    emergencyContact: {
      name: row.contato_emergencia_nome ?? "",
      phone: row.contato_emergencia_telefone ?? "",
    },
    responsavel: {
      nome: row.responsavel_nome ?? "",
      cpf: row.responsavel_cpf ?? "",
      parentesco: row.responsavel_parentesco ?? "",
    },
    hasInsurance: row.tem_plano_saude,
    insuranceName: row.plano_saude_nome ?? "",
    firstAppointmentDate: row.data_primeira_consulta ?? "",
    escolaridade: row.escolaridade ?? "",
    comoConheceu: row.como_conheceu ?? "",
    queixaInicial: row.queixa_inicial ?? "",
    encaminhadoPor: row.encaminhado_por ?? "",
    valorSessao: row.valor_sessao,
    frequenciaPadrao: row.frequencia_padrao ?? "",
    observacoes: row.observacoes ?? "",
    status: row.status,
    arquivadoEm: row.arquivado_em,
    sessions,
    clienteUserId: row.cliente_user_id,
  };
}

export type ListPatientsFilter = {
  // "ativos" (padrão): tudo que não está arquivado, qualquer status.
  // "arquivados": só arquivados. "todos": sem filtro nenhum.
  arquivamento?: "ativos" | "arquivados" | "todos";
  status?: PatientStatus;
};

export async function listPatients(
  supabase: SupabaseClient,
  psicologoId: string,
  filter: ListPatientsFilter = {}
): Promise<Patient[]> {
  let query = supabase
    .from("pacientes")
    .select(PACIENTE_COLUMNS)
    .eq("psicologo_id", psicologoId);

  const arquivamento = filter.arquivamento ?? "ativos";
  if (arquivamento === "ativos") query = query.is("arquivado_em", null);
  if (arquivamento === "arquivados") query = query.not("arquivado_em", "is", null);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query.order("nome");
  if (error) throw new Error(error.message);
  return (data as PacienteRow[]).map((row) => rowToPatient(row));
}

export async function getPatientWithSessions(
  supabase: SupabaseClient,
  patientId: string
): Promise<Patient | null> {
  const { data: paciente, error } = await supabase
    .from("pacientes")
    .select(PACIENTE_COLUMNS)
    .eq("id", patientId)
    .single();
  if (error || !paciente) return null;

  const { data: sessoes } = await supabase
    .from("sessoes_prontuario")
    .select(SESSAO_COLUMNS)
    .eq("paciente_id", patientId)
    .order("data_hora", { ascending: false });

  const sessaoRows = (sessoes ?? []) as SessaoRow[];
  const sessaoIds = sessaoRows.map((s) => s.id);

  const { data: adendoRows } = sessaoIds.length
    ? await supabase
        .from("adendos_evolucao")
        .select("id, evolucao_id, texto, motivo, created_at")
        .in("evolucao_id", sessaoIds)
        .order("created_at")
    : { data: [] as AdendoRow[] };

  const adendosPorEvolucao = new Map<string, Adendo[]>();
  for (const a of (adendoRows ?? []) as AdendoRow[]) {
    const lista = adendosPorEvolucao.get(a.evolucao_id) ?? [];
    lista.push(rowToAdendo(a));
    adendosPorEvolucao.set(a.evolucao_id, lista);
  }

  const sessions: SessionNote[] = sessaoRows.map((s) =>
    rowToSessionNote(s, adendosPorEvolucao.get(s.id) ?? [])
  );

  return rowToPatient(paciente as PacienteRow, sessions);
}

export type NewPatientInput = {
  name: string;
  nomeSocial: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  genero: string;
  endereco: PatientAddress | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelParentesco: string;
  hasInsurance: boolean;
  insuranceName: string;
  firstAppointmentDate: string;
  escolaridade: string;
  comoConheceu: string;
  queixaInicial: string;
  encaminhadoPor: string;
  valorSessao: number | null;
  frequenciaPadrao: string;
  observacoes: string;
};

function patientPayload(psicologoId: string | null, input: NewPatientInput) {
  return {
    ...(psicologoId ? { psicologo_id: psicologoId } : {}),
    nome: input.name,
    nome_social: input.nomeSocial || null,
    cpf: input.cpf || null,
    telefone: input.phone || null,
    email: input.email || null,
    data_nascimento: input.birthDate || null,
    genero: input.genero || null,
    endereco: input.endereco,
    contato_emergencia_nome: input.emergencyContactName || null,
    contato_emergencia_telefone: input.emergencyContactPhone || null,
    responsavel_nome: input.responsavelNome || null,
    responsavel_cpf: input.responsavelCpf || null,
    responsavel_parentesco: input.responsavelParentesco || null,
    tem_plano_saude: input.hasInsurance,
    plano_saude_nome: input.hasInsurance ? input.insuranceName || null : null,
    data_primeira_consulta: input.firstAppointmentDate || null,
    escolaridade: input.escolaridade || null,
    como_conheceu: input.comoConheceu || null,
    queixa_inicial: input.queixaInicial || null,
    encaminhado_por: input.encaminhadoPor || null,
    valor_sessao: input.valorSessao,
    frequencia_padrao: input.frequenciaPadrao || null,
    observacoes: input.observacoes || null,
  };
}

export async function createPatient(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NewPatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("pacientes")
    .insert(patientPayload(psicologoId, input))
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data as PacienteRow);
}

export async function updatePatient(
  supabase: SupabaseClient,
  patientId: string,
  input: NewPatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("pacientes")
    .update(patientPayload(null, input))
    .eq("id", patientId)
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data as PacienteRow);
}

export function patientToFormInput(patient: Patient): NewPatientInput {
  return {
    name: patient.name,
    nomeSocial: patient.nomeSocial,
    cpf: patient.cpf,
    phone: patient.phone,
    email: patient.email,
    birthDate: patient.birthDate,
    genero: patient.genero,
    endereco: patient.endereco,
    emergencyContactName: patient.emergencyContact.name,
    emergencyContactPhone: patient.emergencyContact.phone,
    responsavelNome: patient.responsavel.nome,
    responsavelCpf: patient.responsavel.cpf,
    responsavelParentesco: patient.responsavel.parentesco,
    hasInsurance: patient.hasInsurance,
    insuranceName: patient.insuranceName,
    firstAppointmentDate: patient.firstAppointmentDate,
    escolaridade: patient.escolaridade,
    comoConheceu: patient.comoConheceu,
    queixaInicial: patient.queixaInicial,
    encaminhadoPor: patient.encaminhadoPor,
    valorSessao: patient.valorSessao,
    frequenciaPadrao: patient.frequenciaPadrao,
    observacoes: patient.observacoes,
  };
}

// Prontuário não pode ser apagado por capricho (Res. CFP 01/2009 e
// 06/2019) — não existe mais policy de DELETE em "pacientes" (ver
// schema.sql). Arquivar é a única forma de "remover" um paciente da lista
// ativa; os dados continuam intactos e podem ser reativados.
export async function archivePatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", patientId);
  if (error) throw new Error(error.message);
}

export async function unarchivePatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({ arquivado_em: null })
    .eq("id", patientId);
  if (error) throw new Error(error.message);
}

export async function updatePatientStatus(
  supabase: SupabaseClient,
  patientId: string,
  status: PatientStatus
): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({ status })
    .eq("id", patientId);
  if (error) throw new Error(error.message);
}

export async function unlinkPatientFromClient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({ cliente_user_id: null })
    .eq("id", patientId);
  if (error) throw new Error(error.message);
}

export type SessionNoteOrigin =
  | { origem: "manual" }
  // consentimentoEm é a trilha de auditoria exigida para gravar áudio de
  // sessão (dado sensível de saúde, LGPD art. 11) — ver o modal de
  // transcrição, que só libera a gravação depois da confirmação.
  | {
      origem: "transcricao";
      consentimentoEm: string;
      duracaoSegundos: number;
    };

// Nasce sempre como rascunho (status default no banco) — vira evolução de
// verdade só quando assinada (ver signSessionNote). agendamentoId é
// opcional: liga esta nota a uma consulta "realizada" específica, usado
// pro alerta de "sessões sem evolução" (ver listAgendamentoIdsComEvolucao).
export async function addSessionNote(
  supabase: SupabaseClient,
  patientId: string,
  content: string,
  formato: FormatoEvolucao,
  origin: SessionNoteOrigin = { origem: "manual" },
  agendamentoId: string | null = null,
  geradoPorIa: boolean = false
): Promise<SessionNote> {
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .insert({
      paciente_id: patientId,
      conteudo: content,
      formato,
      agendamento_id: agendamentoId,
      origem: origin.origem,
      gerado_por_ia: geradoPorIa,
      ...(origin.origem === "transcricao"
        ? {
            consentimento_em: origin.consentimentoEm,
            duracao_segundos: origin.duracaoSegundos,
          }
        : {}),
    })
    .select(SESSAO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToSessionNote(data as SessaoRow);
}

// Autosave do rascunho — só funciona enquanto status='rascunho'; o gatilho
// sessoes_prontuario_imutavel no banco bloqueia update depois de assinada
// (a RLS por si só permitiria, é o trigger que trava de verdade).
export async function updateSessionNoteContent(
  supabase: SupabaseClient,
  sessionId: string,
  content: string
): Promise<void> {
  const { error } = await supabase
    .from("sessoes_prontuario")
    .update({ conteudo: content })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Congela o conteúdo, grava o hash SHA-256 e passa status -> assinada.
// Depois disso o trigger de imutabilidade bloqueia qualquer update/delete
// nesta linha, inclusive pelo próprio autor — correção só via adendo.
export async function signSessionNote(
  supabase: SupabaseClient,
  sessionId: string,
  content: string
): Promise<{ assinadoEm: string; hash: string }> {
  const hash = await sha256Hex(content);
  const assinadoEm = new Date().toISOString();
  const { error } = await supabase
    .from("sessoes_prontuario")
    .update({
      conteudo: content,
      status: "assinada",
      assinado_em: assinadoEm,
      hash_conteudo: hash,
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);

  await supabase.rpc("registrar_auditoria", {
    p_acao: "assinou_evolucao",
    p_entidade: "sessoes_prontuario",
    p_entidade_id: sessionId,
  });

  return { assinadoEm, hash };
}

export async function addAdendo(
  supabase: SupabaseClient,
  evolucaoId: string,
  texto: string,
  motivo: string
): Promise<Adendo> {
  const { data, error } = await supabase
    .from("adendos_evolucao")
    .insert({
      evolucao_id: evolucaoId,
      autor_id: (await supabase.auth.getUser()).data.user?.id,
      texto,
      motivo: motivo || null,
    })
    .select("id, evolucao_id, texto, motivo, created_at")
    .single();
  if (error) throw new Error(error.message);
  return rowToAdendo(data as AdendoRow);
}

// Draft ainda pode ser apagado (o trigger só bloqueia quando status já é
// 'assinada' — tentar apagar uma evolução assinada gera o erro do Postgres,
// que a UI nem oferece mais pra evitar).
export async function deleteSessionNote(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  // .select() depois do delete força o Postgres a devolver as linhas
  // realmente apagadas — sem isso, um delete bloqueado pela RLS (ex.: schema
  // ainda não atualizado no Supabase) retorna sucesso com zero linhas
  // afetadas, e a UI achava que tinha apagado sem ter apagado (mesmo padrão
  // de deleteAppointment em appointments-context.tsx).
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .delete()
    .eq("id", sessionId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "A anotação não foi apagada no banco de dados. Confirme se o schema.sql mais recente foi executado no SQL Editor do Supabase."
    );
  }
}

// "X sessões realizadas sem evolução registrada" (alerta da Agenda) —
// devolve o conjunto de agendamento_id que já têm evolução vinculada, pra
// comparar contra as consultas com status='realizada'. RLS de
// sessoes_prontuario já restringe ao psicólogo logado.
export async function listAgendamentoIdsComEvolucao(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .select("agendamento_id")
    .not("agendamento_id", "is", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.agendamento_id as string));
}
