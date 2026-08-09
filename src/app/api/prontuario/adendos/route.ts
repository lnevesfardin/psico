import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptProntuario } from "@/lib/crypto/prontuario-crypto";
import { rowToAdendo, type AdendoRow } from "@/lib/prontuario/mapping";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { evolucaoId, texto, motivo } = (body ?? {}) as {
    evolucaoId?: string;
    texto?: string;
    motivo?: string;
  };
  if (!evolucaoId || typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("adendos_evolucao")
    .insert({
      evolucao_id: evolucaoId,
      autor_id: user.id,
      texto: encryptProntuario(texto),
      motivo: motivo || null,
    })
    .select("id, evolucao_id, texto, motivo, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const row = data as AdendoRow;
  const adendo = rowToAdendo({ ...row, texto });
  return NextResponse.json({ adendo });
}
