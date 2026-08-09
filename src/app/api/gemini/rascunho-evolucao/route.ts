import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { autorizarUsoIA, isIAGuardError, registrarUsoIA } from "@/lib/ia/guards";
import { REGRAS_CLINICAS_IA, MODEL } from "@/lib/ia/prompts";

const MAX_ANOTACOES_LENGTH = 6000;

// Campos por formato — espelha FORMATO_CAMPOS de patient-evolucao-tab.tsx
// (as chaves do JSON de resposta precisam bater com as chaves de "campos"
// no composer pra poder pré-preencher direto, sem mapeamento extra).
const CAMPOS_POR_FORMATO: Record<"dap" | "soap", string[]> = {
  dap: ["Dados", "Avaliação", "Plano"],
  soap: ["Subjetivo", "Objetivo", "Avaliação", "Plano"],
};

function systemInstruction(formato: "dap" | "soap"): string {
  const campos = CAMPOS_POR_FORMATO[formato].join(", ");
  return `Você ajuda um(a) psicólogo(a) a estruturar anotações livres de uma sessão de psicoterapia no formato ${formato.toUpperCase()}.

Você vai receber um texto solto, escrito às pressas pelo psicólogo logo após o atendimento. Sua tarefa é reorganizar ESSE MESMO CONTEÚDO nas seções ${campos}, sem adicionar informação nova — só reestruturar, resumir redundância e corrigir clareza do que já foi escrito.

Se alguma seção não tiver conteúdo correspondente no texto original, devolva essa seção como string vazia — nunca invente conteúdo pra preencher uma seção vazia.

${REGRAS_CLINICAS_IA}

Responda só com o JSON estruturado pedido, nada além disso.`;
}

function buildResponseSchema(formato: "dap" | "soap") {
  const properties: Record<string, { type: Type }> = {};
  for (const campo of CAMPOS_POR_FORMATO[formato]) {
    properties[campo] = { type: Type.STRING };
  }
  return {
    type: Type.OBJECT,
    properties,
    required: CAMPOS_POR_FORMATO[formato],
  };
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { patientId, anotacoes, formato } = (body ?? {}) as {
    patientId?: unknown;
    anotacoes?: unknown;
    formato?: unknown;
  };

  if (typeof patientId !== "string" || !patientId) {
    return NextResponse.json({ error: "Paciente não informado." }, { status: 400 });
  }
  if (formato !== "dap" && formato !== "soap") {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }
  if (typeof anotacoes !== "string" || !anotacoes.trim()) {
    return NextResponse.json({ error: "Escreva suas anotações antes de gerar o rascunho." }, { status: 400 });
  }
  if (anotacoes.length > MAX_ANOTACOES_LENGTH) {
    return NextResponse.json({ error: "Anotações muito longas." }, { status: 400 });
  }

  const guard = await autorizarUsoIA(supabase, patientId);
  if (isIAGuardError(guard)) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user" as const, parts: [{ text: anotacoes.trim() }] }],
      config: {
        systemInstruction: systemInstruction(formato),
        responseMimeType: "application/json",
        responseSchema: buildResponseSchema(formato),
      },
    });

    let campos: Record<string, string>;
    try {
      campos = JSON.parse(response.text ?? "");
    } catch {
      return NextResponse.json(
        { error: "Não foi possível estruturar o rascunho. Tente novamente." },
        { status: 502 }
      );
    }

    await registrarUsoIA(supabase, request, {
      entidade: "sessoes_prontuario",
      pacienteId: patientId,
    });

    return NextResponse.json({ campos });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao gerar rascunho de evolução via IA:", detail);
    return NextResponse.json(
      { error: "Não foi possível gerar o rascunho. Tente novamente.", detail },
      { status: 502 }
    );
  }
}
