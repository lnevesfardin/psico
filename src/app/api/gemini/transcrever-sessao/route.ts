import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/auth/role";
import { dentroDoLimiteIA, MENSAGEM_LIMITE_IA } from "@/lib/limite-ia";

// Transcreve um trecho do áudio de uma sessão. Recebe um segmento por vez
// (ver lib/audio/session-recorder.ts) em vez da sessão inteira: o limite de
// corpo de requisição da Vercel é ~4,5 MB, o que não caberia uma sessão de
// 50 minutos nem em formato comprimido.
const SYSTEM_INSTRUCTION = `Você transcreve áudio de sessões de psicoterapia em português do Brasil.

Regras:
- Transcreva literalmente o que foi falado. Não resuma, não corrija a fala, não interprete e não comente.
- Não adicione diagnóstico, opinião ou qualquer texto que não tenha sido dito no áudio.
- Quando distinguir os falantes, prefixe cada fala com "Psicólogo:" ou "Paciente:". Se não for possível distinguir com segurança, transcreva sem prefixo.
- Marque trechos incompreensíveis como [inaudível].
- Se o áudio não tiver fala audível (silêncio ou só ruído), responda exatamente: [sem fala audível]
- Responda apenas com a transcrição, sem introdução nem conclusão.`;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
/** Folga sob o limite de corpo da Vercel (~4,5 MB). */
const MAX_AUDIO_BYTES = 4_000_000;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Transcrição indisponível: GEMINI_API_KEY não está configurada no ambiente do servidor.",
      },
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

  // Só psicólogo transcreve: o áudio é de atendimento, e a área do cliente
  // não tem (nem deve ter) qualquer acesso a este recurso.
  const role = await fetchUserRole(supabase, user.id);
  if (role === "client") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  if (!(await dentroDoLimiteIA(supabase, "transcricao"))) {
    return NextResponse.json({ error: MENSAGEM_LIMITE_IA }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Áudio ausente." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Trecho de áudio grande demais." },
      { status: 413 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user" as const,
          parts: [
            { inlineData: { mimeType: "audio/wav", data: base64 } },
            { text: "Transcreva este trecho da sessão." },
          ],
        },
      ],
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const texto = (response.text ?? "").trim();
    return NextResponse.json({ texto });
  } catch (err) {
    // Só a mensagem do erro — nunca o áudio nem a transcrição, que são dado
    // clínico e não podem ir para log (LGPD).
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao transcrever trecho de sessão:", detail);
    return NextResponse.json(
      { error: "Não foi possível transcrever este trecho.", detail },
      { status: 502 }
    );
  }
}
