import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { autorizarUsoIA, isIAGuardError, registrarUsoIA } from "@/lib/ia/guards";
import { REGRAS_CLINICAS_IA, MODEL } from "@/lib/ia/prompts";

const MAX_EVOLUCOES = 20;

const SYSTEM_INSTRUCTION = `Você ajuda um(a) psicólogo(a) a notar padrões ao longo do histórico de evoluções de um paciente.

Você vai receber o conteúdo de várias evoluções registradas ao longo do tratamento, da mais antiga pra mais recente. Identifique de 2 a 5 temas ou padrões que aparecem repetidas vezes (ex.: um assunto recorrente, um tipo de situação que se repete, uma mudança de padrão ao longo do tempo).

Cada tema deve ser uma OBSERVAÇÃO factual e curta (o que se repete, não o motivo nem o significado) — nunca uma conclusão, interpretação clínica ou diagnóstico. É o psicólogo quem interpreta o que esses temas significam, você só aponta o que se repete no texto.

${REGRAS_CLINICAS_IA}

Se não houver conteúdo suficiente para identificar nenhum padrão com confiança, devolva uma lista vazia — nunca invente um tema pra preencher.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    temas: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["temas"],
};

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

  const { patientId } = (body ?? {}) as { patientId?: unknown };
  if (typeof patientId !== "string" || !patientId) {
    return NextResponse.json({ error: "Paciente não informado." }, { status: 400 });
  }

  const guard = await autorizarUsoIA(supabase, patientId);
  if (isIAGuardError(guard)) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data: evolucoes } = await supabase
    .from("sessoes_prontuario")
    .select("conteudo, data_hora")
    .eq("paciente_id", patientId)
    .order("data_hora", { ascending: false })
    .limit(MAX_EVOLUCOES);

  if (!evolucoes || evolucoes.length < 3) {
    return NextResponse.json(
      { error: "É preciso pelo menos 3 evoluções registradas para identificar padrões." },
      { status: 400 }
    );
  }

  const contexto = [...evolucoes]
    .reverse()
    .map((e, i) => `Evolução ${i + 1}:\n${e.conteudo}`)
    .join("\n\n");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user" as const, parts: [{ text: contexto }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    let parsed: { temas?: unknown };
    try {
      parsed = JSON.parse(response.text ?? "{}");
    } catch {
      return NextResponse.json(
        { error: "Não foi possível identificar temas. Tente novamente." },
        { status: 502 }
      );
    }

    const temas = Array.isArray(parsed.temas) ? parsed.temas.filter((t) => typeof t === "string") : [];

    await registrarUsoIA(supabase, request, {
      entidade: "sessoes_prontuario",
      pacienteId: patientId,
    });

    return NextResponse.json({ temas });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao identificar temas recorrentes via IA:", detail);
    return NextResponse.json(
      { error: "Não foi possível identificar temas. Tente novamente.", detail },
      { status: 502 }
    );
  }
}
