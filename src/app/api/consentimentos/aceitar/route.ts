import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEXTOS_CONSENTIMENTO, type TipoConsentimento } from "@/lib/consentimentos-client";

const TIPOS_VALIDOS: TipoConsentimento[] = ["contrato_tdic", "lgpd", "processamento_ia"];

/**
 * Registra o aceite de um termo pelo paciente logado. Passa por aqui (não
 * uma chamada direta à RPC do client) só por causa do IP — a LGPD pede a
 * trilha de quando/onde o aceite aconteceu, e o cabeçalho da requisição só
 * existe num route handler, nunca numa chamada supabase-js direto do
 * navegador.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tipo = body?.tipo;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de consentimento inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { versao, texto } = TEXTOS_CONSENTIMENTO[tipo as TipoConsentimento];
  const hash = createHash("sha256").update(texto).digest("hex");

  // x-forwarded-for pode vir com uma lista "cliente, proxy1, proxy2" — o
  // primeiro é o IP de origem real.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const { error } = await supabase.rpc("aceitar_consentimento", {
    p_tipo: tipo,
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
