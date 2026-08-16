import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { dentroDoLimiteIA, MENSAGEM_LIMITE_IA } from "@/lib/limite-ia";

// Instrução fixa do usuário: extrair um lançamento financeiro descrito em
// texto livre para os 4 campos do formulário "Novo Lançamento". O resultado
// só pré-preenche o formulário — quem lança de fato é o psicólogo, clicando
// em "Salvar lançamento" manualmente (nunca gravamos nada aqui).
const SYSTEM_INSTRUCTION = `Atue como assistente financeiro de atendimento. Toda vez que receber a descrição de um novo lançamento, extraia e organize obrigatoriamente os seguintes campos:

Data: (data do lançamento, formato AAAA-MM-DD; se não houver data explícita, use a data de hoje informada)
Paciente: (nome do paciente exatamente como mencionado no texto)
Valor (R$): (valor numérico, sem símbolo de moeda)
Status: (apenas "pago" se o texto indicar que já foi recebido/pago, ou "pendente" se indicar que ainda não foi pago ou não mencionar; padrão é "pendente")

Responda só com os dados extraídos, sem explicações.`;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_TEXT_LENGTH = 500;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    data: { type: Type.STRING, description: "AAAA-MM-DD" },
    paciente: { type: Type.STRING },
    valor: { type: Type.NUMBER },
    status: { type: Type.STRING, format: "enum", enum: ["pago", "pendente"] },
  },
  required: ["data", "paciente", "valor", "status"],
};

type Extraido = {
  data: string;
  paciente: string;
  valor: number;
  status: "pago" | "pendente";
};

function isExtraido(value: unknown): value is Extraido {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.data === "string" &&
    typeof v.paciente === "string" &&
    typeof v.valor === "number" &&
    (v.status === "pago" || v.status === "pendente")
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  if (!(await dentroDoLimiteIA(supabase, "lancamento"))) {
    return NextResponse.json({ error: MENSAGEM_LIMITE_IA }, { status: 429 });
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

  const { texto } = (body ?? {}) as { texto?: unknown };
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ error: "Descreva o lançamento." }, { status: 400 });
  }
  if (texto.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Texto muito longo." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const hoje = new Date().toISOString().slice(0, 10);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user" as const,
          parts: [{ text: `Data de hoje: ${hoje}\n\nTexto do lançamento: ${texto.trim()}` }],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text ?? "");
    } catch {
      return NextResponse.json(
        { error: "Não foi possível interpretar o lançamento. Tente descrever de outra forma." },
        { status: 502 }
      );
    }

    if (!isExtraido(parsed)) {
      return NextResponse.json(
        { error: "Não foi possível interpretar o lançamento. Tente descrever de outra forma." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao extrair lançamento via Gemini:", detail);
    return NextResponse.json(
      {
        error: "Não foi possível extrair o lançamento. Tente novamente.",
        detail,
      },
      { status: 502 }
    );
  }
}
