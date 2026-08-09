import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptProntuario } from "@/lib/crypto/prontuario-crypto";

// Autosave do rascunho (chamado a cada ~10s pelo composer). O gatilho
// sessoes_prontuario_imutavel no banco continua sendo a trava de verdade
// contra editar uma evolução já assinada — este handler só cifra o
// conteúdo antes de mandar pro update, RLS/trigger decidem o resto.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const content = body?.content;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Conteúdo vazio." }, { status: 400 });
  }

  const { error } = await supabase
    .from("sessoes_prontuario")
    .update({ conteudo: encryptProntuario(content) })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
