import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_INSTRUCTION = `Você é o assistente virtual oficial do Psi Rob, uma plataforma de gestão para consultórios e clínicas de psicologia (agendamento de consultas, cadastro de pacientes, prontuário eletrônico e financeiro).

Seu papel é ajudar a pessoa que está usando a plataforma — psicólogo(a) ou cliente/paciente — a entender e usar as funcionalidades do sistema: Agenda, Pacientes & Prontuários, Financeiro, Meu Perfil, Link de Agendamento (para psicólogos) e Meus Agendamentos / Buscar Psicólogo (para clientes).

Regras importantes:
- Responda sempre em português do Brasil, de forma breve, clara e cordial.
- Você não é um profissional de saúde: nunca dê aconselhamento clínico, diagnóstico ou orientação terapêutica. Se a pessoa trouxer uma questão clínica ou de saúde mental, oriente-a a conversar diretamente com o psicólogo responsável.
- Nunca peça, armazene ou repita de volta dados sensíveis de pacientes (CPF, conteúdo de prontuário, diagnósticos) durante a conversa.
- Se não souber a resposta sobre uma funcionalidade específica da plataforma, seja honesto em vez de inventar.`;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
    return NextResponse.json(
      { error: "Assistente indisponível no momento." },
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
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    return NextResponse.json({ text: response.text ?? "" });
  } catch (err) {
    console.error(
      "Erro ao chamar a API do Gemini:",
      err instanceof Error ? err.message : "erro desconhecido"
    );
    return NextResponse.json(
      { error: "Não foi possível obter resposta do assistente. Tente novamente." },
      { status: 502 }
    );
  }
}
