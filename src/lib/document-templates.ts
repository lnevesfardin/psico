import type { SupabaseClient } from "@supabase/supabase-js";
import type { Patient } from "@/lib/dashboard-data";
import type { Profile } from "@/lib/profile-data";
import { formatDateExtenso, formatDateShort } from "@/lib/format";
import { escapeHtml, linhasParaParagrafos, pareceHtml } from "@/lib/rich-text";
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

/**
 * Devolve SEMPRE HTML, com todo valor substituído já escapado.
 *
 * O documento preenchido acaba renderizado via dangerouslySetInnerHTML (aba de
 * documentos) e exportado pro .doc. Nome e CPF podem ter vindo do formulário
 * PÚBLICO de agendamento, onde qualquer visitante digita texto livre — sem
 * escapar, um nome como `<img src=x onerror=...>` vira script rodando na
 * sessão do psicólogo, que enxerga todos os prontuários.
 *
 * Escapar só quando o modelo já é HTML não basta, e é uma armadilha: num
 * modelo em texto puro (anterior ao editor rico) é o próprio valor injetado
 * que faz o resultado "parecer HTML", e aí o ensureHtml lá na frente devolve
 * tudo cru. Por isso a conversão de texto puro pra HTML acontece aqui dentro,
 * decidida pelo modelo ORIGINAL, e não por uma nova detecção depois da
 * substituição.
 */
/**
 * Substitui [valor] e [sessão(ões)...] no modelo de Recibo por dados reais
 * de um lançamento pago — só usado no fluxo "Emitir recibo" a partir do
 * Financeiro (ver patient-documents-tab.tsx). Roda ANTES de fillPlaceholders,
 * sobre o texto ORIGINAL do modelo: nada do que é injetado aqui contém "<",
 * então não interfere na decisão texto-puro-vs-HTML que fillPlaceholders faz
 * a partir do modelo original (ver o comentário grande logo abaixo). Os
 * demais campos entre colchetes de outros modelos continuam para
 * preenchimento manual, de propósito — não têm dado estruturado equivalente
 * no sistema (ex.: "valor por extenso" exigiria converter número em texto).
 *
 * Se o psicólogo já tiver editado o próprio modelo e removido esses
 * marcadores, o replace simplesmente não encontra nada e não faz nada — o
 * campo entre colchetes original (se sobrar algum) continua pra
 * preenchimento manual, mesmo comportamento de usar o modelo sem este atalho.
 */
export function preencherValorNoRecibo(
  conteudo: string,
  lancamento: { valor: number; descricao: string | null }
): string {
  let resultado = conteudo.replace(
    "[valor]",
    lancamento.valor.toFixed(2).replace(".", ",")
  );
  if (lancamento.descricao) {
    resultado = resultado.replace(
      "[sessão(ões) de atendimento psicológico]",
      escapeHtml(lancamento.descricao)
    );
  }
  return resultado;
}

export function fillPlaceholders(
  conteudo: string,
  patient: Patient,
  profile: Profile,
  emissionDate: Date
): string {
  const modeloEraHtml = pareceHtml(conteudo);
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
  // Os tokens não têm caractere especial de HTML, então escapar o modelo em
  // texto puro antes não atrapalha a substituição abaixo.
  let out = modeloEraHtml ? conteudo : escapeHtml(conteudo);
  for (const [token, value] of Object.entries(values)) {
    out = out.split(token).join(escapeHtml(value));
  }
  return modeloEraHtml ? out : linhasParaParagrafos(out);
}

export type PresetTemplate = { tipo: string; nome: string; conteudo: string };

/**
 * Ponto de partida para o psicólogo customizar, não texto pronto pra usar
 * sem revisão. Para os documentos regulados (laudo, receituário, plano de
 * segurança) o conteúdo é deliberadamente um esqueleto com colchetes a
 * preencher, em vez de um texto "pronto" — fabricar conteúdo técnico/legal
 * detalhado nesses casos seria arriscado sem supervisão profissional.
 */
/**
 * Primeira linha de cada modelo abaixo é sempre o título (ex.: "ATESTADO
 * PSICOLÓGICO") — vira um heading centralizado em PRESET_TEMPLATES logo
 * abaixo, em vez de texto comum do mesmo tamanho do resto.
 */
const PRESET_TEMPLATES_TEXTO: PresetTemplate[] = [
  {
    tipo: "Anamnese",
    nome: "Anamnese Clínica (adulto)",
    conteudo: `ANAMNESE CLÍNICA

1. IDENTIFICAÇÃO
Nome: {{paciente_nome}}
CPF: {{paciente_cpf}}
Data de nascimento: {{paciente_data_nascimento}}
Estado civil: [ ]
Escolaridade: [ ]
Profissão / ocupação atual: [ ]
Com quem reside: [ ]
Data da entrevista: {{data_emissao}}

2. QUEIXA PRINCIPAL
[o que traz a pessoa ao atendimento, nas palavras dela]

3. HISTÓRIA DA QUEIXA
[quando começou, como evoluiu, o que piora e o que alivia, o que já tentou]

4. HISTÓRICO DE SAÚDE MENTAL
Atendimentos anteriores (psicoterapia/psiquiatria): [ ]
Internações: [ ]
Medicação em uso (nome, dose e prescritor): [ ]
Histórico familiar de transtornos mentais: [ ]

5. HISTÓRICO DE SAÚDE GERAL
Condições clínicas e cirurgias: [ ]
Uso de álcool e outras substâncias: [ ]
Sono, apetite e atividade física: [ ]

6. HISTÓRIA DE VIDA
Composição e dinâmica familiar: [ ]
Infância e adolescência: [ ]
Vida escolar e profissional: [ ]
Relacionamentos afetivos: [ ]
Rede de apoio social: [ ]
Eventos significativos / perdas: [ ]

7. AVALIAÇÃO DE RISCO
Ideação suicida (atual e pregressa): [ ]
Planejamento, tentativas anteriores e acesso a meios: [ ]
Autolesão: [ ]
Situação de violência (sofrida ou praticada): [ ]
[Havendo risco identificado, registrar as condutas adotadas e considerar o
modelo "Plano de Segurança — Prevenção ao Suicídio".]

8. OBSERVAÇÕES DA ENTREVISTA
[apresentação, contato, humor, linguagem e demais impressões clínicas]

9. OBJETIVOS DO ACOMPANHAMENTO
[demanda combinada com o paciente e primeiras hipóteses de trabalho]

10. ENCAMINHAMENTOS E CONDUTAS
[frequência combinada, encaminhamentos, orientações]


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
  {
    tipo: "Anamnese",
    nome: "Anamnese Infantil (com responsável)",
    conteudo: `ANAMNESE INFANTIL

[Entrevista realizada com o(a) responsável. Registrar quem prestou as
informações e o vínculo com a criança/adolescente.]

1. IDENTIFICAÇÃO
Nome: {{paciente_nome}}
Data de nascimento: {{paciente_data_nascimento}}
Idade: [ ]
Escola / ano escolar: [ ]
Responsável entrevistado(a) e vínculo: [ ]
Data da entrevista: {{data_emissao}}

2. COMPOSIÇÃO FAMILIAR
[quem mora na casa, idades e ocupações; guarda e convivência, se aplicável]

3. QUEIXA PRINCIPAL
[o que motivou a procura, segundo o responsável]
Quem indicou o atendimento: [escola, pediatra, familiar...]

4. GESTAÇÃO E NASCIMENTO
Gestação (planejada, intercorrências): [ ]
Parto e condições de nascimento: [ ]
Amamentação: [ ]

5. DESENVOLVIMENTO
Marcos motores (sentar, andar): [ ]
Linguagem (primeiras palavras e frases): [ ]
Controle esfincteriano: [ ]
Sono e alimentação: [ ]

6. SAÚDE
Doenças, cirurgias e internações: [ ]
Medicação em uso: [ ]
Avaliações e terapias anteriores (fono, TO, neuro, psico): [ ]

7. VIDA ESCOLAR
Adaptação e rendimento: [ ]
Relação com professores e colegas: [ ]
Queixas relatadas pela escola: [ ]

8. COMPORTAMENTO E CONVIVÊNCIA
Rotina diária: [ ]
Brincadeiras e interesses: [ ]
Reação a limites e frustração: [ ]
Uso de telas: [ ]
Relação com irmãos e cuidadores: [ ]

9. OBSERVAÇÕES DA ENTREVISTA
[impressões clínicas sobre a criança/adolescente e sobre a dinâmica familiar]

10. OBJETIVOS E CONDUTAS
[demanda combinada com a família, encaminhamentos e orientações]


_____________________________________
{{psicologo_nome}}
{{psicologo_titulo}}
{{psicologo_crp}}`,
  },
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


_____________________________________
{{psicologo_nome}} ({{psicologo_crp}})
CONTRATADO(A)


_____________________________________
{{paciente_nome}}
CONTRATANTE`,
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


_____________________________________
{{psicologo_nome}} ({{psicologo_crp}})


_____________________________________
{{paciente_nome}}`,
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

/**
 * Promove a primeira linha (sempre o título) a heading centralizado, e
 * converte o resto para o mesmo HTML que fillPlaceholders geraria de um
 * texto puro — necessário porque, a partir daqui, o conteúdo já "parece
 * HTML" (tem uma tag), e pareceHtml() trata isso como tudo-ou-nada: sem essa
 * conversão manual do resto, as quebras de linha do corpo se perderiam,
 * virando um parágrafo só.
 */
function comTituloDestacado(conteudo: string): string {
  const [titulo, ...linhas] = conteudo.split("\n");
  const corpo = linhas.map((linha) => `<p>${escapeHtml(linha)}</p>`).join("");
  return `<h1 style="text-align:center">${escapeHtml(titulo)}</h1>${corpo}`;
}

export const PRESET_TEMPLATES: PresetTemplate[] = PRESET_TEMPLATES_TEXTO.map(
  (preset) => ({ ...preset, conteudo: comTituloDestacado(preset.conteudo) })
);
