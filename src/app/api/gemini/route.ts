import { NextResponse } from "next/server";
import { GoogleGenAI, type Content, type FunctionCall, type Tool } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole, type Role } from "@/lib/auth/role";
import { dentroDoLimiteIA, MENSAGEM_LIMITE_IA } from "@/lib/limite-ia";
import { enviarEmail } from "@/lib/notificacoes/email";

const COMMON_RULES = `Regras importantes:
- Responda sempre em português do Brasil, de forma breve, clara e cordial.
- Você não é um profissional de saúde: nunca dê aconselhamento clínico, diagnóstico ou orientação terapêutica. Se a pessoa trouxer uma questão clínica ou de saúde mental, oriente-a a conversar diretamente com o psicólogo responsável.
- Nunca peça, armazene ou repita de volta dados sensíveis de pacientes (CPF, conteúdo de prontuário, diagnósticos) durante a conversa.
- Se não souber a resposta sobre uma funcionalidade específica da plataforma, seja honesto em vez de inventar.
- Responda em texto simples, sem Markdown (sem **negrito**, sem #títulos, sem listas com * ou -) — a interface de chat exibe texto puro. Se precisar listar itens, separe por vírgula ou por linhas com números (1., 2., 3.).
- Se a pessoa quiser falar com o suporte, relatar um problema ou reclamar de algo, você pode enviar um e-mail por ela através da função enviar_email_suporte. Primeiro pergunte o que ela quer dizer (se ela ainda não disse) e confirme com ela antes de enviar (ex.: "posso mandar isso pro suporte?"). Só chame a função depois dessa confirmação explícita — nunca envie sem a pessoa concordar. Nunca inclua CPF, conteúdo de prontuário ou outro dado sensível de paciente no e-mail.`;

// Prompts segregados por papel: o assistente aparece tanto na área do
// psicólogo (/dashboard) quanto na área do cliente (/agendamentos), mas cada
// uma tem funcionalidades exclusivas (ex.: Prontuário e Financeiro só existem
// pro psicólogo). Um prompt único que conhecia as duas listas deixava o
// assistente responder sobre a área errada; aqui cada papel só recebe a
// descrição do que existe na própria área.
const SYSTEM_INSTRUCTION_PSYCHOLOGIST = `Você é o assistente virtual oficial do Psico, uma plataforma de gestão para consultórios e clínicas de psicologia.

Você está ajudando um(a) PSICÓLOGO(A) (profissional) na área de gestão do consultório. As funcionalidades disponíveis para ele(a) são: Agenda de Hoje, Pacientes & Prontuários, Financeiro / Recibos, Meu Link de Agendamento e Meu Perfil.

Se a pergunta for sobre algo que só existe na área do cliente/paciente (buscar psicólogo, agendar consulta como paciente, etc.), explique que essa funcionalidade não faz parte da área do profissional e não tente respondê-la.

${COMMON_RULES}`;

const SYSTEM_INSTRUCTION_CLIENT = `Você é o assistente virtual oficial do Psico, uma plataforma de gestão para consultórios e clínicas de psicologia.

Você está ajudando um(a) CLIENTE/PACIENTE que usa a plataforma para acompanhar suas consultas. As funcionalidades disponíveis para ele(a) são: Meus Agendamentos, Humor (check-in de bem-estar) e Meu Perfil.

Não existe busca de psicólogos na plataforma: o agendamento é feito pelo link que o próprio psicólogo envia ao paciente. A conta do paciente também só é criada por convite do psicólogo.

Se a pergunta for sobre algo que só existe na área do psicólogo (prontuário, financeiro do consultório, agenda de atendimentos, link de agendamento, etc.), explique que essa funcionalidade não faz parte da área do cliente e não tente respondê-la.

${COMMON_RULES}`;

function systemInstructionForRole(role: Role | null): string {
  return role === "client"
    ? SYSTEM_INSTRUCTION_CLIENT
    : SYSTEM_INSTRUCTION_PSYCHOLOGIST;
}

// "gemini-2.5-flash" (nome fixo) foi descontinuado para chaves novas da API
// — usamos o alias "-latest", que a Google atualiza automaticamente pro
// flash recomendado do momento, pra não repetir esse problema no futuro.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_HISTORY_TURNS = 20;
const MAX_MESSAGE_LENGTH = 4000;

type ChatRole = "user" | "model";
type ChatMessage = { role: ChatRole; text: string };

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === "user" || v.role === "model") && typeof v.text === "string"
  );
}

// Única function tool do assistente: manda um e-mail pro suporte em nome de
// quem está conversando. O texto vem inteiro do modelo (não é o usuário
// escrevendo direto num campo de formulário), por isso a confirmação
// explícita antes de chamar é regra do prompt (ver COMMON_RULES), não coisa
// que dá pra garantir só no código.
const SUPPORT_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "enviar_email_suporte",
        description:
          "Envia um e-mail para o suporte do Psico com o que a pessoa quer relatar ou pedir. Use somente depois que a pessoa confirmar claramente que quer enviar — nunca chame sem essa confirmação. Não inclua CPF, conteúdo de prontuário ou outro dado sensível de paciente no texto.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            assunto: {
              type: "string",
              description: "Resumo curto (poucas palavras) do motivo do contato.",
            },
            mensagem: {
              type: "string",
              description:
                "O que a pessoa quer dizer ao suporte, com as próprias palavras dela.",
            },
          },
          required: ["assunto", "mensagem"],
        },
      },
    ],
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dígito verificador de CPF (módulo 11) — mesmo cálculo usado pela Receita. */
function cpfValido(cpf: string): boolean {
  // "00000000000", "11111111111" etc. passam no cálculo do dígito mas nunca
  // são CPF de verdade — filtrados à parte.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

/**
 * Trava de verdade no código, não só instrução no prompt: o modelo já é
 * instruído a nunca incluir CPF, mas isso é comportamento, não garantia —
 * uma frase insistente o suficiente pode furar. Isto barra o envio de fato
 * se o texto contiver um CPF válido.
 *
 * Só CPF, não "qualquer dado sensível": é o único caso com um formato
 * verificável por código (dígito verificador). "Conteúdo de prontuário" ou
 * "diagnóstico" são texto livre — não dá pra detectar isso com uma regex sem
 * outra chamada de IA por cima, o que traria o mesmo problema de novo (é
 * comportamento de modelo, não garantia de código).
 *
 * Valida o dígito verificador (não só "11 dígitos seguidos") de propósito:
 * telefone celular brasileiro com DDD também tem 11 dígitos, e bloquear
 * qualquer sequência de 11 dígitos derrubaria mensagem legítima como "meu
 * telefone é 11987654321". Exigir o dígito verificador batendo deixa a
 * chance de falso positivo em ~1%.
 */
function contemCpf(texto: string): boolean {
  const candidatos = texto.match(/\d[\d.\-\s]{9,}\d/g) ?? [];
  return candidatos.some((bruto) => {
    const digitos = bruto.replace(/\D/g, "");
    return digitos.length === 11 && cpfValido(digitos);
  });
}

/**
 * Executa a function call decidida pelo modelo. O e-mail de quem está
 * conversando vem da própria sessão autenticada (nunca de um campo que o
 * modelo preencheria) — não dá pra falsificar remetente por prompt injection
 * na conversa, e todo envio fica rastreável até uma conta de verdade.
 */
async function executarFuncaoDeSuporte(
  chamada: FunctionCall,
  contexto: { userEmail: string | undefined; role: Role | null; supabase: Awaited<ReturnType<typeof createClient>> }
): Promise<Record<string, unknown>> {
  if (chamada.name !== "enviar_email_suporte") {
    return { error: "Função desconhecida." };
  }

  if (!(await dentroDoLimiteIA(contexto.supabase, "suporte_email"))) {
    return { error: MENSAGEM_LIMITE_IA };
  }

  const destinatario = process.env.SUPPORT_EMAIL;
  if (!destinatario) {
    return {
      error: "O envio de e-mail para o suporte não está configurado no momento.",
    };
  }

  const args = chamada.args ?? {};
  const assunto =
    typeof args.assunto === "string" && args.assunto.trim()
      ? args.assunto.trim().slice(0, 200)
      : "Contato via assistente";
  const mensagem =
    typeof args.mensagem === "string" ? args.mensagem.trim().slice(0, 4000) : "";

  if (!mensagem) {
    return { error: "A mensagem veio vazia — nada foi enviado." };
  }

  if (contemCpf(assunto) || contemCpf(mensagem)) {
    return {
      error:
        "A mensagem parece conter um CPF. Por segurança, remova esse dado antes de enviar ao suporte.",
    };
  }

  const remetente = `${contexto.userEmail ?? "e-mail não disponível"} (${
    contexto.role === "client" ? "paciente" : "psicólogo"
  })`;
  const corpoTexto = `Mensagem enviada pelo assistente de IA do Psico.\n\nDe: ${remetente}\n\n${mensagem}`;
  const corpoHtml = `<p>Mensagem enviada pelo assistente de IA do Psico.</p><p>De: ${escapeHtml(remetente)}</p><p>${escapeHtml(mensagem).replace(/\n/g, "<br>")}</p>`;

  const resultado = await enviarEmail(destinatario, {
    assunto: `[Assistente Psico] ${assunto}`,
    texto: corpoTexto,
    html: corpoHtml,
  });

  if (!resultado.ok) {
    // Só a mensagem do erro (chave/remetente mal configurado, Brevo fora do
    // ar) — nunca o conteúdo da mensagem, que pode ter dado pessoal de quem
    // escreveu.
    console.error("Erro ao enviar e-mail de suporte via assistente:", resultado.erro);
    return { error: "Não foi possível enviar o e-mail agora." };
  }
  return { output: "E-mail enviado com sucesso." };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Mensagem explícita (não só "indisponível"): a causa mais comum é a env
    // var existir em .env.local (dev) mas não ter sido configurada também
    // nas Environment Variables do projeto na Vercel (produção usa só isso).
    return NextResponse.json(
      { error: "Assistente indisponível: GEMINI_API_KEY não está configurada no ambiente do servidor." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!(await dentroDoLimiteIA(supabase, "chat"))) {
    return NextResponse.json({ error: MENSAGEM_LIMITE_IA }, { status: 429 });
  }

  const role = await fetchUserRole(supabase, user.id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { message, history } = (body ?? {}) as {
    message?: unknown;
    history?: unknown;
  };

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Mensagem muito longa." },
      { status: 400 }
    );
  }

  const safeHistory: ChatMessage[] = Array.isArray(history)
    ? history.filter(isChatMessage).slice(-MAX_HISTORY_TURNS)
    : [];

  const ai = new GoogleGenAI({ apiKey });
  const config = {
    systemInstruction: systemInstructionForRole(role),
    tools: SUPPORT_TOOLS,
  };

  try {
    const contents: Content[] = [
      ...safeHistory.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
      { role: "user" as const, parts: [{ text: message.trim() }] },
    ];

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config,
    });

    const chamadas = response.functionCalls;
    if (chamadas && chamadas.length > 0) {
      // No máximo uma chamada por turno: uma mensagem só pede um contato de
      // suporte por vez, não faz sentido o modelo disparar várias.
      const resultado = await executarFuncaoDeSuporte(chamadas[0], {
        userEmail: user.email,
        role,
        supabase,
      });

      const respostaFinal = await ai.models.generateContent({
        model: MODEL,
        contents: [
          ...contents,
          // Content devolvido pelo modelo, ecoado de volta como o protocolo
          // de function calling exige — não reconstruído à mão, pra não
          // divergir do que ele realmente mandou.
          response.candidates?.[0]?.content ?? {
            role: "model" as const,
            parts: [{ functionCall: chamadas[0] }],
          },
          {
            role: "user" as const,
            parts: [
              {
                functionResponse: {
                  id: chamadas[0].id,
                  name: chamadas[0].name,
                  response: resultado,
                },
              },
            ],
          },
        ],
        config,
      });

      return NextResponse.json({ text: respostaFinal.text ?? "" });
    }

    return NextResponse.json({ text: response.text ?? "" });
  } catch (err) {
    // O erro do SDK do Gemini não carrega dado de paciente (mensagem vem da
    // API do Google, ex.: chave inválida, modelo inexistente, cota
    // excedida) — seguro expor ao psicólogo/cliente para diagnóstico via
    // Network tab, sem precisar dos logs da Vercel.
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao chamar a API do Gemini:", detail);
    return NextResponse.json(
      {
        error: "Não foi possível obter resposta do assistente. Tente novamente.",
        detail,
      },
      { status: 502 }
    );
  }
}
