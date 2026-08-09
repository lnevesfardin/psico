import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEXTOS_CONSENTIMENTO } from "@/lib/consentimentos-client";

/**
 * Registra o consentimento de gravação de sessão em nome do paciente,
 * chamado pelo PSICÓLOGO no momento de iniciar a gravação (ver
 * session-transcription-modal.tsx) — diferente de /aceitar, que é sempre o
 * próprio titular. Passa por aqui (não a RPC direto do client) pelo mesmo
 * motivo de sempre: IP só existe no cabeçalho de um route handler.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pacienteId = body?.pacienteId;
  if (typeof pacienteId !== "string" || !pacienteId) {
    return NextResponse.json({ error: "Paciente não informado." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { versao, texto } = TEXTOS_CONSENTIMENTO.gravacao_sessao;
  const hash = createHash("sha256").update(texto).digest("hex");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const { error } = await supabase.rpc("registrar_consentimento_gravacao", {
    p_paciente_id: pacienteId,
    p_versao_texto: versao,
    p_texto_integral: texto,
    p_hash_texto: hash,
    p_ip: ip,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
