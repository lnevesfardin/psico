import type { SupabaseClient } from "@supabase/supabase-js";
import type { Patient } from "@/lib/dashboard-data";
import type { Profile } from "@/lib/profile-data";
import { formatDateExtenso, formatDateShort } from "@/lib/format";
import { exigirLinhaAfetada } from "@/lib/supabase/escrita";

export type DocumentTemplate = {
  id: string;
  tipo: string;
  nome: string;
  conteudo: string;
  createdAt: string;
  updatedAt: string;
};

type TemplateRow = {
  id: string;
  tipo: string;
  nome: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
};

const TEMPLATE_COLUMNS = "id, tipo, nome, conteudo, created_at, updated_at";

function rowToTemplate(row: TemplateRow): DocumentTemplate {
  return {
    id: row.id,
    tipo: row.tipo,
    nome: row.nome,
    conteudo: row.conteudo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDocumentTemplates(
  supabase: SupabaseClient,
  psicologoId: string
): Promise<DocumentTemplate[]> {
  const { data, error } = await supabase
    .from("modelos_documentos")
    .select(TEMPLATE_COLUMNS)
    .eq("psicologo_id", psicologoId)
    .order("tipo")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data as TemplateRow[]).map(rowToTemplate);
}

export type DocumentTemplateInput = {
  tipo: string;
  nome: string;
  conteudo: string;
};

export async function createDocumentTemplate(
  supabase: SupabaseClient,
  psicologoId: string,
  input: DocumentTemplateInput
): Promise<DocumentTemplate> {
  const { data, error } = await supabase
    .from("modelos_documentos")
    .insert({ psicologo_id: psicologoId, ...input })
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToTemplate(data as TemplateRow);
}

export async function updateDocumentTemplate(
  supabase: SupabaseClient,
  templateId: string,
  input: DocumentTemplateInput
): Promise<DocumentTemplate> {
  const { data, error } = await supabase
    .from("modelos_documentos")
    .update(input)
    .eq("id", templateId)
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToTemplate(data as TemplateRow);
}

export async function deleteDocumentTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("modelos_documentos")
    .delete()
    .eq("id", templateId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirLinhaAfetada(data, "O modelo de documento");
}

/**
 * Tokens preenchidos automaticamente a partir do paciente, do perfil do
 * psicólogo e da data de emissão (ver fillPlaceholders). O resto do texto do
 * modelo (finalidade, conteúdo técnico, valores etc.) é digitado pelo
 * próprio psicólogo — não dá pra derivar isso de dado nenhum do sistema.
 */
export const PLACEHOLDER_TOKENS: { token: string; label: string }[] = [
  { token: "{{paciente_nome}}", label: "Nome do paciente" },
  { token: "{{paciente_cpf}}", label: "CPF do paciente" },
  { token: "{{paciente_data_nascimento}}", label: "Data de nascimento do paciente" },
  { token: "{{paciente_data_primeira_consulta}}", label: "Data da primeira consulta" },
  { token: "{{psicologo_nome}}", label: "Nome do psicólogo" },
  { token: "{{psicologo_titulo}}", label: "Título profissional" },
  { token: "{{psicologo_crp}}", label: "CRP" },
  { token: "{{psicologo_cidade}}", label: "Cidade" },
  { token: "{{data_emissao}}", label: "Data de emissão (curta)" },
  { token: "{{data_emissao_extenso}}", label: "Data de emissão (por extenso)" },
];

export function fillPlaceholders(
  conteudo: string,
  patient: Patient,
  profile: Profile,
  emissionDate: Date
): string {
  const values: Record<string, string> = {
    "{{paciente_nome}}": patient.name || "—",
    "{{paciente_cpf}}": patient.cpf || "—",
    "{{paciente_data_nascimento}}": patient.birthDate
      ? formatDateShort(patient.birthDate)
      : "—",
    "{{paciente_data_primeira_consulta}}": patient.firstAppointmentDate
      ? formatDateShort(patient.firstAppointmentDate)
      : "—",
    "{{psicologo_nome}}": profile.name || "—",
    "{{psicologo_titulo}}": profile.title || "—",
    "{{psicologo_crp}}": profile.crp || "—",
    "{{psicologo_cidade}}": profile.cidade || "—",
    "{{data_emissao}}": emissionDate.toLocaleDateString("pt-BR"),
    "{{data_emissao_extenso}}": formatDateExtenso(emissionDate),
  };
  let out = conteudo;
  for (const [token, value] of Object.entries(values)) {
    out = out.split(token).join(value);
  }
  return out;
}

export type PresetTemplate = { tipo: string; nome: string; conteudo: string };

/**
 * Ponto de partida para o psicólogo customizar, não texto pronto pra usar
 * sem revisão. Para os documentos regulados (laudo, receituário, plano de
 * segurança) o conteúdo é deliberadamente um esqueleto com colchetes a
 * preencher, em vez de um texto "pronto" — fabricar conteúdo técnico/legal
 * detalhado nesses casos seria arriscado sem supervisão profissional.
 */
export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    tipo: "Atestado",
    nome: "Atestado Psicológico",
    conteudo: `ATESTADO PSICOLÓGICO

Atesto, para os devidos fins, que {{paciente_nome}}, portador(a) do CPF {{paciente_cpf}}, está em acompanhamento psicológico sob minha responsabilidade profissional.

[descrever a finalidade do atestado]

Este documento é emitido a pedido do(a) paciente, para os fins que se fizerem necessários.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Atestado",
    nome: "Atestado Psicológico - Modelo 1",
    conteudo: `ATESTADO PSICOLÓGICO

Atesto que {{paciente_nome}}, CPF {{paciente_cpf}}, encontra-se em acompanhamento psicológico comigo, necessitando de afastamento de suas atividades por [número] dia(s), a partir de {{data_emissao}}, por motivo de saúde.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Atestado",
    nome: "Atestado - Modelo 2",
    conteudo: `ATESTADO

Atesto que {{paciente_nome}} compareceu a atendimento psicológico nesta data, {{data_emissao}}, no período das [hora início] às [hora fim].

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Contrato",
    nome: "Contrato de Psicoterapia - Modelo 1",
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS PSICOTERÁPICOS

Pelo presente instrumento, {{psicologo_nome}}, {{psicologo_titulo}}, inscrito(a) no {{psicologo_crp}}, doravante CONTRATADO(A), e {{paciente_nome}}, CPF {{paciente_cpf}}, doravante CONTRATANTE, firmam o presente contrato de prestação de serviços psicoterápicos, mediante as cláusulas a seguir:

1. OBJETO
O(A) CONTRATADO(A) prestará atendimento psicoterápico ao(à) CONTRATANTE, em sessões com periodicidade e duração a serem combinadas entre as partes.

2. SIGILO PROFISSIONAL
As informações compartilhadas durante o atendimento são protegidas por sigilo profissional, conforme o Código de Ética Profissional do Psicólogo, ressalvadas as exceções previstas em lei.

3. VALOR E FORMA DE PAGAMENTO
O valor de cada sessão é de [valor], a ser pago [forma e prazo de pagamento].

4. FALTAS E CANCELAMENTOS
[descrever a política de cancelamento e reagendamento adotada]

5. VIGÊNCIA
Este contrato vigora a partir de {{data_emissao}}, podendo ser encerrado por qualquer das partes mediante comunicação prévia.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________          _____________________________________
{{psicologo_nome}} ({{psicologo_crp}})          {{paciente_nome}}
CONTRATADO(A)                                   CONTRATANTE`,
  },
  {
    tipo: "Contrato",
    nome: "Contrato de Psicoterapia - Modelo 2",
    conteudo: `TERMO DE CONSENTIMENTO E CONTRATO TERAPÊUTICO

Eu, {{paciente_nome}}, CPF {{paciente_cpf}}, declaro estar ciente e de acordo com os termos do atendimento psicológico a ser realizado por {{psicologo_nome}} ({{psicologo_crp}}), incluindo:

- Sigilo profissional das informações compartilhadas, respeitadas as exceções previstas em lei;
- Frequência das sessões: [definir];
- Valor por sessão: [definir] e política de cancelamento: [definir];
- Possibilidade de encerramento do acompanhamento por qualquer das partes, mediante comunicação prévia.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________          _____________________________________
{{psicologo_nome}} ({{psicologo_crp}})          {{paciente_nome}}`,
  },
  {
    tipo: "Declaração",
    nome: "Declaração",
    conteudo: `DECLARAÇÃO

Declaro, para os devidos fins, que {{paciente_nome}}, CPF {{paciente_cpf}}, é paciente em acompanhamento psicológico sob minha responsabilidade profissional desde {{paciente_data_primeira_consulta}}.

[descrever a finalidade da declaração]

Por ser verdade, firmo a presente declaração.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Declaração",
    nome: "Declaração Plano de Saúde ABAS",
    conteudo: `DECLARAÇÃO PARA PLANO DE SAÚDE

Declaro, para fins de reembolso/autorização junto ao plano de saúde, que {{paciente_nome}}, CPF {{paciente_cpf}}, encontra-se em acompanhamento psicológico sob minha responsabilidade, com sessões realizadas [frequência], desde {{paciente_data_primeira_consulta}}.

[adapte este texto às exigências específicas do convênio — ex.: CID, código de procedimento, número de sessões no período]

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Encaminhamento",
    nome: "Encaminhamento",
    conteudo: `ENCAMINHAMENTO

Encaminho {{paciente_nome}}, CPF {{paciente_cpf}}, em acompanhamento psicológico comigo, para avaliação/atendimento com [especialidade ou profissional de destino], em razão de [motivo do encaminhamento].

Permaneço à disposição para troca de informações, mediante autorização do(a) paciente.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Laudo",
    nome: "Laudo",
    conteudo: `LAUDO PSICOLÓGICO

1. IDENTIFICAÇÃO
Nome: {{paciente_nome}}
CPF: {{paciente_cpf}}
Data de nascimento: {{paciente_data_nascimento}}

2. DESCRIÇÃO DA DEMANDA
[motivo da avaliação e quem a solicitou]

3. PROCEDIMENTOS UTILIZADOS
[entrevistas, instrumentos e técnicas utilizadas, com datas]

4. ANÁLISE
[análise técnica das informações levantadas]

5. CONCLUSÃO
[conclusão e, quando aplicável, encaminhamentos]

Laudo elaborado em conformidade com as normas do Conselho Federal de Psicologia (Resolução CFP nº 06/2019).

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Plano de Segurança",
    nome: "Plano de Segurança - Prevenção ao Suicídio",
    conteudo: `PLANO DE SEGURANÇA — PREVENÇÃO AO SUICÍDIO

Paciente: {{paciente_nome}}
Elaborado em: {{data_emissao}}

[Este plano deve ser construído em conjunto com o(a) paciente durante o atendimento, e revisado periodicamente — não é um documento para preencher sozinho.]

1. SINAIS DE ALERTA
[pensamentos, sensações ou comportamentos que indicam o início de uma crise]

2. ESTRATÉGIAS DE ENFRENTAMENTO (sozinho)
[atividades que ajudam a se distrair ou se acalmar sem precisar contatar outra pessoa]

3. PESSOAS E AMBIENTES QUE AJUDAM A DISTRAIR
[contatos sociais e locais que trazem segurança]

4. PESSOAS A QUEM PEDIR AJUDA
Nome / contato: _______________________
Nome / contato: _______________________

5. PROFISSIONAIS E SERVIÇOS DE EMERGÊNCIA
Psicólogo(a): {{psicologo_nome}} — {{psicologo_crp}}
CVV: 188 (24h, gratuito) — www.cvv.org.br
SAMU: 192

6. TORNANDO O AMBIENTE MAIS SEGURO
[meios de acesso a métodos de risco a restringir, combinado com o paciente]`,
  },
  {
    tipo: "Protocolo",
    nome: "Protocolo de Entrega de Laudos e Documentos",
    conteudo: `PROTOCOLO DE ENTREGA DE LAUDOS E DOCUMENTOS

Declaro ter recebido, nesta data, os seguintes documentos elaborados por {{psicologo_nome}} ({{psicologo_crp}}), referentes a {{paciente_nome}}, CPF {{paciente_cpf}}:

[ ] Laudo psicológico
[ ] Atestado
[ ] Declaração
[ ] Relatório
[ ] Outro: _______________________

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
Assinatura de quem recebeu o documento`,
  },
  {
    tipo: "Receituário",
    nome: "Receituário Controle Especial",
    conteudo: `RECEITUÁRIO DE CONTROLE ESPECIAL

[ATENÇÃO: a prescrição de medicamentos sujeitos a controle especial (Portaria SVS/MS nº 344/98) é ato médico — psicólogos não têm competência legal para prescrever medicamentos. Use este modelo somente se o documento for emitido por profissional habilitado (médico/psiquiatra), revisando nome e conselho profissional no fecho antes de usar.]

Paciente: {{paciente_nome}}
CPF: {{paciente_cpf}}
Data de nascimento: {{paciente_data_nascimento}}

Uso: [interno/externo]

_______________________________________________
[medicamento, concentração, forma farmacêutica, quantidade]

Posologia: [instruções de uso]

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
[nome do profissional prescritor]
[conselho profissional e número de registro]`,
  },
  {
    tipo: "Recibo",
    nome: "Recibo de Pagamento",
    conteudo: `RECIBO DE PAGAMENTO

Recebi de {{paciente_nome}}, CPF {{paciente_cpf}}, a quantia de R$ [valor] ([valor por extenso]), referente a [sessão(ões) de atendimento psicológico], realizada(s) em {{data_emissao}}.

Para clareza, firmo o presente recibo.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}} — {{psicologo_crp}}`,
  },
  {
    tipo: "Relatório",
    nome: "Relatório",
    conteudo: `RELATÓRIO PSICOLÓGICO

1. IDENTIFICAÇÃO
Nome: {{paciente_nome}}
CPF: {{paciente_cpf}}
Data de nascimento: {{paciente_data_nascimento}}
Em acompanhamento desde: {{paciente_data_primeira_consulta}}

2. FINALIDADE DO RELATÓRIO
[a quem se destina e o motivo da solicitação]

3. SÍNTESE DO ACOMPANHAMENTO
[evolução observada ao longo do processo terapêutico, sem detalhar conteúdo sigiloso das sessões além do estritamente necessário à finalidade]

4. CONSIDERAÇÕES FINAIS
[observações e, se aplicável, recomendações]

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Termo",
    nome: "Termo de Autorização para menores de idade",
    conteudo: `TERMO DE AUTORIZAÇÃO PARA ATENDIMENTO PSICOLÓGICO DE MENOR DE IDADE

Eu, [nome do responsável legal], CPF [CPF do responsável], na qualidade de responsável legal por {{paciente_nome}}, CPF {{paciente_cpf}}, nascido(a) em {{paciente_data_nascimento}}, autorizo o acompanhamento psicológico do(a) menor por {{psicologo_nome}} ({{psicologo_crp}}).

Declaro estar ciente de que:
- As informações compartilhadas pelo(a) menor durante o atendimento são protegidas por sigilo profissional, respeitado o melhor interesse da criança/adolescente e as exceções previstas em lei;
- Serei informado(a) sobre o andamento geral do acompanhamento, preservado o sigilo do conteúdo específico das sessões, conforme orientação ética do Conselho Federal de Psicologia.

{{psicologo_cidade}}, {{data_emissao_extenso}}.


_____________________________________
Assinatura do(a) responsável legal`,
  },
];
