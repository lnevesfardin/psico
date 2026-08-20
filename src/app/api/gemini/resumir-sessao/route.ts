import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/auth/role";
import { dentroDoLimiteIA, MENSAGEM_LIMITE_IA } from "@/lib/limite-ia";

// Gera um RASCUNHO de evolução a partir de uma transcrição já revisada pelo
// psicólogo (ver session-transcription-modal.tsx) — nunca do áudio direto.
// Continua exigindo revisão antes de salvar, igual à transcrição: o texto
// cai na mesma textarea editável, nada é salvo automaticamente.
const SYSTEM_INSTRUCTION = `Você ajuda um psicólogo a transformar a transcrição de uma sessão de psicoterapia em um rascunho de evolução para o prontuário, em português do Brasil.

Regras:
- Baseie-se SOMENTE no que está na transcrição. Não invente falas, fatos ou informações que não estejam nela.
- Não atribua diagnóstico, não sugira medicação e não faça interpretação clínica além do que foi dito na sessão.
- Escreva em tom profissional e descritivo (ex.: "O paciente relatou...", "Foram discutidos os temas..."), nunca conclusivo sobre a condição do paciente.
- Organize em até três seções curtas, só quando houver conteúdo pra elas: "Temas abordados", "Observações" (comportamento ou estado relatado/observável na fala, não diagnóstico) e "Encaminhamentos" (combinados feitos na própria sessão, se houver).
- Seja conciso: é um rascunho para o psicólogo revisar e completar, não a versão final.
- Se a transcrição não tiver conteúdo suficiente para um resumo, responda exatamente: [transcrição insuficiente para gerar um resumo]
- Responda apenas com o rascunho, sem introdução nem conclusão.`;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
/** Uma sessão de 50min transcrita fica bem abaixo disso. */
const MAX_CHARS = 60_000;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Resumo indisponível: GEMINI_API_KEY não está configurada no ambiente do servidor.",
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

  // Mesma regra da transcrição: só psicólogo, área do cliente não tem acesso.
  const role = await fetchUserRole(supabase, user.id);
  if (role === "client") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  if (!(await dentroDoLimiteIA(supabase, "resumo"))) {
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

  const texto = (body as { texto?: unknown } | null)?.texto;
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ error: "Transcrição ausente." }, { status: 400 });
  }
  if (texto.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "Transcrição grande demais para resumir." },
      { status: 413 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user" as const, parts: [{ text: texto }] }],
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const resumo = (response.text ?? "").trim();
    return NextResponse.json({ resumo });
  } catch (err) {
    // Só a mensagem do erro — nunca a transcrição nem o resumo, que são
    // dado clínico e não podem ir para log (LGPD).
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao gerar resumo de sessão:", detail);
    return NextResponse.json(
      { error: "Não foi possível gerar o rascunho.", detail },
      { status: 502 }
    );
  }
}
