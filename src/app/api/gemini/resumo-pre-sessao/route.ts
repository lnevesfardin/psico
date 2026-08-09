import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { autorizarUsoIA, isIAGuardError, registrarUsoIA } from "@/lib/ia/guards";
import { decryptProntuario } from "@/lib/crypto/prontuario-crypto";
import { listObjetivosAbertosByPatient } from "@/lib/planos-terapeuticos-client";
import { listTarefasByPatient } from "@/lib/tarefas-client";
import { REGRAS_CLINICAS_IA, MODEL } from "@/lib/ia/prompts";

const SYSTEM_INSTRUCTION = `Você ajuda um(a) psicólogo(a) a se preparar para uma sessão, sintetizando o histórico recente do paciente.

Você vai receber o conteúdo das últimas evoluções registradas, os objetivos terapêuticos em aberto e as tarefas de casa pendentes. Escreva uma síntese de NO MÁXIMO 5 LINHAS, destacando o que está pendente e os objetivos em aberto — não repita tudo, escolha o que é mais relevante pra retomar a sessão.

${REGRAS_CLINICAS_IA}

Responda só com a síntese em texto simples (sem Markdown, sem títulos), no máximo 5 linhas.`;

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

  const [{ data: evolucoes }, objetivos, tarefas] = await Promise.all([
    supabase
      .from("sessoes_prontuario")
      .select("conteudo, data_hora, formato")
      .eq("paciente_id", patientId)
      .order("data_hora", { ascending: false })
      .limit(3),
    listObjetivosAbertosByPatient(supabase, patientId),
    listTarefasByPatient(supabase, patientId),
  ]);

  if (!evolucoes || evolucoes.length === 0) {
    return NextResponse.json(
      { error: "Ainda não há evoluções registradas para gerar um resumo." },
      { status: 400 }
    );
  }

  const tarefasPendentes = tarefas.filter((t) => !t.concluidaEm);

  const contexto = [
    "Últimas evoluções (mais recente primeiro):",
    ...evolucoes.map((e, i) => `${i + 1}. ${decryptProntuario(e.conteudo)}`),
    "",
    "Objetivos terapêuticos em aberto:",
    objetivos.length > 0 ? objetivos.map((o) => `- ${o.descricao}`).join("\n") : "(nenhum)",
    "",
    "Tarefas de casa pendentes:",
    tarefasPendentes.length > 0 ? tarefasPendentes.map((t) => `- ${t.titulo}`).join("\n") : "(nenhuma)",
  ].join("\n");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user" as const, parts: [{ text: contexto }] }],
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    await registrarUsoIA(supabase, request, {
      entidade: "sessoes_prontuario",
      pacienteId: patientId,
    });

    return NextResponse.json({ resumo: (response.text ?? "").trim() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro ao gerar resumo pré-sessão via IA:", detail);
    return NextResponse.json(
      { error: "Não foi possível gerar o resumo. Tente novamente.", detail },
      { status: 502 }
    );
  }
}
