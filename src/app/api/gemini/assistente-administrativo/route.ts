import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { autorizarUsoIA, isIAGuardError, registrarUsoIA } from "@/lib/ia/guards";
import { REGRAS_CLINICAS_IA, MODEL } from "@/lib/ia/prompts";

const MAX_CONTEXTO_LENGTH = 1000;

export type TipoAssistenteAdministrativo = "remarcacao" | "orientacao" | "tarefa_casa";

const TIPOS_VALIDOS: TipoAssistenteAdministrativo[] = ["remarcacao", "orientacao", "tarefa_casa"];

const INSTRUCAO_POR_TIPO: Record<TipoAssistenteAdministrativo, string> = {
  remarcacao: `Redija uma mensagem curta e cordial pedindo para remarcar uma consulta, para ser enviada diretamente ao paciente (WhatsApp/e-mail). Use o contexto informado pelo psicólogo (motivo, nova data se houver). Tom profissional e acolhedor, sem detalhes clínicos.`,
  orientacao: `Redija uma orientação clara e objetiva para o paciente seguir entre as sessões, com base no contexto informado pelo psicólogo. Tom acolhedor e direto, em linguagem acessível (não técnica).`,
  tarefa_casa: `Redija o texto de instruções de uma tarefa de casa (tarefa terapêutica) para o paciente, com base no contexto informado pelo psicólogo. Seja claro sobre o que o paciente deve fazer e, se fizer sentido, com que frequência.`,
};

function systemInstruction(tipo: TipoAssistenteAdministrativo): string {
  return `Você ajuda um(a) psicólogo(a) a redigir textos administrativos para pacientes.

${INSTRUCAO_POR_TIPO[tipo]}

${REGRAS_CLINICAS_IA}

Responda só com o texto da mensagem, pronto para copiar e enviar — sem introdução, sem explicações, sem aspas envolvendo o texto todo.`;
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

  const { patientId, tipo, contexto } = (body ?? {}) as {
    patientId?: unknown;
    tipo?: unknown;
    contexto?: unknown;
  };

  if (typeof patientId !== "string" || !patientId) {
    return NextResponse.json({ error: "Paciente não informado." }, { status: 400 });
  }
  if (typeof tipo !== "string" || !TIPOS_VALIDOS.includes(tipo as TipoAssistenteAdministrativo)) {
    return NextResponse.json({ error: "Tipo de mensagem inválido." }, { status: 400 });
  }
  if (typeof contexto !== "string" || !contexto.trim()) {
    return NextResponse.json({ error: "Descreva o que a mensagem precisa dizer." }, { status: 400 });
  }
  if (contexto.length > MAX_CONTEXTO_LENGTH) {
    return NextResponse.json({ error: "Texto muito longo." }, { status: 400 });
  }

  const guard = await autorizarUsoIA(supabase, patientId);
  if (isIAGuardError(guard)) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user" as const, parts: [{ text: contexto.trim() }] }],
      config: { systemInstruction: systemInstruction(tipo as TipoAssistenteAdministrativo) },
    });

    await registrarUsoIA(supabase, request, {
      entidade: "assistente_administrativo",
      pacienteId: patientId,
    });

    return NextResponse.json({ texto: (response.text ?? "").trim() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao gerar texto administrativo via IA:", detail);
    return NextResponse.json(
      { error: "Não foi possível gerar o texto. Tente novamente.", detail },
      { status: 502 }
    );
  }
}
