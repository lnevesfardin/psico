import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole, type Role } from "@/lib/auth/role";
import { dentroDoLimiteIA, MENSAGEM_LIMITE_IA } from "@/lib/limite-ia";

const COMMON_RULES = `Regras importantes:
- Responda sempre em português do Brasil, de forma breve, clara e cordial.
- Você não é um profissional de saúde: nunca dê aconselhamento clínico, diagnóstico ou orientação terapêutica. Se a pessoa trouxer uma questão clínica ou de saúde mental, oriente-a a conversar diretamente com o psicólogo responsável.
- Nunca peça, armazene ou repita de volta dados sensíveis de pacientes (CPF, conteúdo de prontuário, diagnósticos) durante a conversa.
- Se não souber a resposta sobre uma funcionalidade específica da plataforma, seja honesto em vez de inventar.
- Responda em texto simples, sem Markdown (sem **negrito**, sem #títulos, sem listas com * ou -) — a interface de chat exibe texto puro. Se precisar listar itens, separe por vírgula ou por linhas com números (1., 2., 3.).`;

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

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        ...safeHistory.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
        { role: "user" as const, parts: [{ text: message.trim() }] },
      ],
      config: {
        systemInstruction: systemInstructionForRole(role),
      },
    });

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
