import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Complexidade,
  Participante,
  Patient,
  SessionNote,
  TipoFicha,
} from "@/lib/dashboard-data";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

type ParticipanteRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
};

const PARTICIPANTE_COLUMNS = "id, nome, telefone, email";

function rowToParticipante(row: ParticipanteRow): Participante {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone ?? "",
    email: row.email ?? "",
  };
}

type PacienteRow = {
  id: string;
  created_at: string;
  tipo: TipoFicha | null;
  complexidade: Complexidade | null;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  tem_plano_saude: boolean;
  plano_saude_nome: string | null;
  data_primeira_consulta: string | null;
  escolaridade: string | null;
  como_conheceu: string | null;
  observacoes: string | null;
  cliente_user_id: string | null;
};

const PACIENTE_COLUMNS_BASE =
  "id, created_at, nome, cpf, telefone, email, data_nascimento, contato_emergencia_nome, contato_emergencia_telefone, tem_plano_saude, plano_saude_nome, data_primeira_consulta, escolaridade, como_conheceu, observacoes, cliente_user_id";

const PACIENTE_COLUMNS = `${PACIENTE_COLUMNS_BASE}, tipo, complexidade`;

type ResumoSessoes = { total: number; ultima: string | null };

function rowToPatient(
  row: PacienteRow,
  sessions: SessionNote[] = [],
  participantes: Participante[] = [],
  resumo?: ResumoSessoes
): Patient {
  return {
    totalSessoes: resumo?.total ?? sessions.length,
    // sessions vem ordenada da mais recente para a mais antiga.
    ultimaSessaoEm: resumo?.ultima ?? sessions[0]?.dateTime ?? null,
    id: row.id,
    createdAt: row.created_at,
    // Ficha antiga (anterior à coluna) é indivíduo — o default do banco diz o
    // mesmo, mas o fallback também cobre o select sem a coluna, usado
    // enquanto o schema.sql ainda não foi aplicado à mão.
    tipo: row.tipo ?? "individuo",
    complexidade: row.complexidade ?? null,
    participantes,
    name: row.nome,
    cpf: row.cpf ?? "",
    phone: row.telefone ?? "",
    email: row.email ?? "",
    birthDate: row.data_nascimento ?? "",
    emergencyContact: {
      name: row.contato_emergencia_nome ?? "",
      phone: row.contato_emergencia_telefone ?? "",
    },
    hasInsurance: row.tem_plano_saude,
    insuranceName: row.plano_saude_nome ?? "",
    firstAppointmentDate: row.data_primeira_consulta ?? "",
    escolaridade: row.escolaridade ?? "",
    comoConheceu: row.como_conheceu ?? "",
    observacoes: row.observacoes ?? "",
    sessions,
    clienteUserId: row.cliente_user_id,
  };
}

export async function listPatients(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<Patient[]> {
  const buscar = (colunas: string) =>
    supabase
      .from("pacientes")
      .select(colunas)
      .eq("psicologo_id", psicologoId)
      .order("nome");

  // Mesma proteção do perfil: o deploy chega antes do schema.sql ser rodado à
  // mão, e uma coluna inexistente derrubaria a lista inteira de pacientes.
  let { data, error } = await buscar(PACIENTE_COLUMNS);
  if (error) ({ data, error } = await buscar(PACIENTE_COLUMNS_BASE));
  if (error) throw new Error(error.message);

  const rows = data as unknown as PacienteRow[];
  const resumos = await resumirSessoes(
    supabase,
    rows.map((r) => r.id)
  );

  return rows.map((row) => rowToPatient(row, [], [], resumos.get(row.id)));
}

/**
 * Total e data da última sessão de cada ficha, em uma consulta só.
 *
 * Traz apenas paciente_id e data_hora: montar a lista não é motivo para o
 * conteúdo das evoluções sair do banco (minimização de dado, ver CLAUDE.md).
 * Falha aqui devolve mapa vazio — a lista aparece sem o resumo, em vez de
 * não aparecer.
 */
async function resumirSessoes(
  supabase: SupabaseClient,
  patientIds: string[]
): Promise<Map<string, ResumoSessoes>> {
  const resumos = new Map<string, ResumoSessoes>();
  if (patientIds.length === 0) return resumos;

  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .select("paciente_id, data_hora")
    .in("paciente_id", patientIds)
    .order("data_hora", { ascending: false });
  if (error || !data) return resumos;

  for (const linha of data as { paciente_id: string; data_hora: string }[]) {
    const atual = resumos.get(linha.paciente_id);
    if (atual) {
      atual.total += 1; // a primeira vista já era a mais recente (order desc)
    } else {
      resumos.set(linha.paciente_id, { total: 1, ultima: linha.data_hora });
    }
  }
  return resumos;
}

/**
 * Trilha de auditoria (LGPD, ver acessos_prontuario no schema.sql):
 * registra a abertura do prontuário. Fire-and-forget de propósito — falha
 * ao gravar o log (ex.: schema.sql ainda não atualizado) não pode impedir
 * o atendimento.
 */
async function registrarAcessoProntuario(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("acessos_prontuario")
    .insert({ psicologo_id: user.id, paciente_id: patientId });
}

export async function getPatientWithSessions(
  supabase: SupabaseClient,
  patientId: string
): Promise<Patient | null> {
  const buscar = (colunas: string) =>
    supabase.from("pacientes").select(colunas).eq("id", patientId).single();

  let { data: paciente, error } = await buscar(PACIENTE_COLUMNS);
  if (error) ({ data: paciente, error } = await buscar(PACIENTE_COLUMNS_BASE));
  if (error || !paciente) return null;

  registrarAcessoProntuario(supabase, patientId).catch(() => {});

  // Participantes só existem em ficha de casal/grupo; a tabela pode ainda nem
  // existir no banco, então erro aqui vira lista vazia em vez de derrubar o
  // prontuário inteiro.
  const { data: participantesRows } = await supabase
    .from("participantes_ficha")
    .select(PARTICIPANTE_COLUMNS)
    .eq("paciente_id", patientId)
    .order("created_at");

  const { data: sessoes } = await supabase
    .from("sessoes_prontuario")
    .select("id, conteudo, data_hora, origem, updated_at")
    .eq("paciente_id", patientId)
    .order("data_hora", { ascending: false });

  const sessions: SessionNote[] = (sessoes ?? []).map((s) => ({
    id: s.id as string,
    content: s.conteudo as string,
    dateTime: s.data_hora as string,
    origem: (s.origem as SessionNote["origem"]) ?? "manual",
    updatedAt: (s.updated_at as string) ?? (s.data_hora as string),
  }));

  return rowToPatient(
    paciente as unknown as PacienteRow,
    sessions,
    ((participantesRows ?? []) as ParticipanteRow[]).map(rowToParticipante)
  );
}

/** Participante como o formulário entrega: ainda sem id (nem sempre existe). */
export type ParticipanteInput = {
  nome: string;
  telefone: string;
  email: string;
};

/**
 * Regrava a lista de participantes da ficha: apaga o que havia e insere de
 * novo. Trocar tudo (em vez de comparar linha a linha) é o suficiente aqui —
 * são poucas pessoas por ficha, e nada mais no sistema aponta para o id do
 * participante, então recriá-los não quebra referência nenhuma.
 */
async function sincronizarParticipantes(
  supabase: SupabaseClient,
  patientId: string,
  participantes: ParticipanteInput[]
): Promise<void> {
  await supabase.from("participantes_ficha").delete().eq("paciente_id", patientId);

  const linhas = participantes
    .filter((p) => p.nome.trim())
    .map((p) => ({
      paciente_id: patientId,
      nome: p.nome.trim(),
      telefone: p.telefone.trim() || null,
      email: p.email.trim() || null,
    }));

  if (linhas.length === 0) return;
  const { error } = await supabase.from("participantes_ficha").insert(linhas);
  if (error) throw new Error(error.message);
}

export type NewPatientInput = {
  tipo: TipoFicha;
  complexidade: Complexidade | null;
  participantes: ParticipanteInput[];
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  hasInsurance: boolean;
  insuranceName: string;
  firstAppointmentDate: string;
  escolaridade: string;
  comoConheceu: string;
  observacoes: string;
};

export async function createPatient(
  supabase: SupabaseClient,
  psicologoId: string,
  input: NewPatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      psicologo_id: psicologoId,
      tipo: input.tipo,
      complexidade: input.complexidade,
      nome: input.name,
      cpf: input.cpf || null,
      telefone: input.phone || null,
      email: input.email || null,
      data_nascimento: input.birthDate || null,
      contato_emergencia_nome: input.emergencyContactName || null,
      contato_emergencia_telefone: input.emergencyContactPhone || null,
      tem_plano_saude: input.hasInsurance,
      plano_saude_nome: input.hasInsurance ? input.insuranceName || null : null,
      data_primeira_consulta: input.firstAppointmentDate || null,
      escolaridade: input.escolaridade || null,
      como_conheceu: input.comoConheceu || null,
      observacoes: input.observacoes || null,
    })
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  const paciente = data as unknown as PacienteRow;
  const participantes =
    input.tipo === "individuo" ? [] : input.participantes;
  if (participantes.length > 0) {
    await sincronizarParticipantes(supabase, paciente.id, participantes);
  }
  return rowToPatient(paciente, [], participantesComId(participantes));
}

/**
 * Devolve os participantes recém-gravados para a UI sem uma segunda ida ao
 * banco. O id aqui é só chave de renderização — a lista é relida do banco na
 * próxima abertura da ficha.
 */
function participantesComId(entrada: ParticipanteInput[]): Participante[] {
  return entrada
    .filter((p) => p.nome.trim())
    .map((p, i) => ({
      id: `novo-${i}`,
      nome: p.nome.trim(),
      telefone: p.telefone.trim(),
      email: p.email.trim(),
    }));
}

export async function updatePatient(
  supabase: SupabaseClient,
  patientId: string,
  input: NewPatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("pacientes")
    .update({
      tipo: input.tipo,
      complexidade: input.complexidade,
      nome: input.name,
      cpf: input.cpf || null,
      telefone: input.phone || null,
      email: input.email || null,
      data_nascimento: input.birthDate || null,
      contato_emergencia_nome: input.emergencyContactName || null,
      contato_emergencia_telefone: input.emergencyContactPhone || null,
      tem_plano_saude: input.hasInsurance,
      plano_saude_nome: input.hasInsurance ? input.insuranceName || null : null,
      data_primeira_consulta: input.firstAppointmentDate || null,
      escolaridade: input.escolaridade || null,
      como_conheceu: input.comoConheceu || null,
      observacoes: input.observacoes || null,
    })
    .eq("id", patientId)
    .select(PACIENTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  // Indivíduo não tem participante: trocar o tipo de casal para indivíduo
  // precisa limpar a lista, senão sobrariam pessoas invisíveis na ficha.
  const participantes = input.tipo === "individuo" ? [] : input.participantes;
  await sincronizarParticipantes(supabase, patientId, participantes);

  return rowToPatient(
    data as unknown as PacienteRow,
    [],
    participantesComId(participantes)
  );
}

export function patientToFormInput(patient: Patient): NewPatientInput {
  return {
    tipo: patient.tipo,
    complexidade: patient.complexidade,
    participantes: patient.participantes.map((p) => ({
      nome: p.nome,
      telefone: p.telefone,
      email: p.email,
    })),
    name: patient.name,
    cpf: patient.cpf,
    phone: patient.phone,
    email: patient.email,
    birthDate: patient.birthDate,
    emergencyContactName: patient.emergencyContact.name,
    emergencyContactPhone: patient.emergencyContact.phone,
    hasInsurance: patient.hasInsurance,
    insuranceName: patient.insuranceName,
    firstAppointmentDate: patient.firstAppointmentDate,
    escolaridade: patient.escolaridade,
    comoConheceu: patient.comoConheceu,
    observacoes: patient.observacoes,
  };
}

export async function deletePatient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("pacientes")
    .delete()
    .eq("id", patientId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "O paciente");
}

export async function unlinkPatientFromClient(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("pacientes")
    .update({ cliente_user_id: null })
    .eq("id", patientId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "A desvinculação da conta do paciente");
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

export async function addSessionNote(
  supabase: SupabaseClient,
  patientId: string,
  content: string,
  origin: SessionNoteOrigin = { origem: "manual" }
): Promise<SessionNote> {
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .insert({
      paciente_id: patientId,
      conteudo: content,
      origem: origin.origem,
      ...(origin.origem === "transcricao"
        ? {
            consentimento_em: origin.consentimentoEm,
            duracao_segundos: origin.duracaoSegundos,
          }
        : {}),
    })
    .select("id, conteudo, data_hora, origem, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    content: data.conteudo as string,
    dateTime: data.data_hora as string,
    origem: (data.origem as SessionNote["origem"]) ?? "manual",
    updatedAt: (data.updated_at as string) ?? (data.data_hora as string),
  };
}

export async function updateSessionNote(
  supabase: SupabaseClient,
  sessionId: string,
  content: string
): Promise<SessionNote> {
  // .select() depois do update, mesmo motivo de deleteSessionNote: sem isso
  // um update bloqueado pela RLS (schema ainda não atualizado, ou tentativa
  // de editar anotação de paciente de outro psicólogo) retornaria sucesso
  // com zero linhas afetadas, e a UI acharia que salvou sem ter salvo.
  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .update({ conteudo: content })
    .eq("id", sessionId)
    .select("id, conteudo, data_hora, origem, updated_at");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "A anotação não foi salva no banco de dados. Confirme se o schema.sql mais recente foi executado no SQL Editor do Supabase."
    );
  }
  const row = data[0];
  return {
    id: row.id as string,
    content: row.conteudo as string,
    dateTime: row.data_hora as string,
    origem: (row.origem as SessionNote["origem"]) ?? "manual",
    updatedAt: row.updated_at as string,
  };
}

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
