import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptProntuario } from "@/lib/crypto/prontuario-crypto";

// Congela o conteúdo, grava o hash SHA-256 do texto EM CLARO (calculado
// aqui, antes de cifrar — é o hash que dá pra provar mais tarde que o
// conteúdo assinado não foi alterado, tem que ser do texto real, não do
// ciphertext) e passa status -> assinada. Depois disso o trigger de
// imutabilidade bloqueia qualquer update/delete nesta linha.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const hash = createHash("sha256").update(content, "utf8").digest("hex");
  const assinadoEm = new Date().toISOString();

  const { error } = await supabase
    .from("sessoes_prontuario")
    .update({
      conteudo: encryptProntuario(content),
      status: "assinada",
      assinado_em: assinadoEm,
      hash_conteudo: hash,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.rpc("registrar_auditoria", {
    p_acao: "assinou_evolucao",
    p_entidade: "sessoes_prontuario",
    p_entidade_id: id,
  });

  return NextResponse.json({ assinadoEm, hash });
}
