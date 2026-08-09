import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptProntuario } from "@/lib/crypto/prontuario-crypto";
import { rowToAdendo, rowToSessionNote, SESSAO_COLUMNS, type AdendoRow, type SessaoRow } from "@/lib/prontuario/mapping";
import type { Adendo, SessionNote } from "@/lib/dashboard-data";

// Lista as evoluções (+ adendos) de um paciente já decifradas. Só existe
// como rota (não select direto do client) porque "conteudo"/"texto" ficam
// cifrados no banco — decifrar exige a chave, que só este servidor tem.
// RLS aplica normalmente: o client aqui é o mesmo autenticado por cookie do
// navegador, então só devolve o que o psicólogo logado já podia ver antes.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: sessoes, error } = await supabase
    .from("sessoes_prontuario")
    .select(SESSAO_COLUMNS)
    .eq("paciente_id", patientId)
    .order("data_hora", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const sessaoRows = (sessoes ?? []) as SessaoRow[];
  const sessaoIds = sessaoRows.map((s) => s.id);

  const { data: adendoRows } = sessaoIds.length
    ? await supabase
        .from("adendos_evolucao")
        .select("id, evolucao_id, texto, motivo, created_at")
        .in("evolucao_id", sessaoIds)
        .order("created_at")
    : { data: [] as AdendoRow[] };

  const adendosPorEvolucao = new Map<string, Adendo[]>();
  for (const a of (adendoRows ?? []) as AdendoRow[]) {
    const lista = adendosPorEvolucao.get(a.evolucao_id) ?? [];
    lista.push(rowToAdendo({ ...a, texto: decryptProntuario(a.texto) }));
    adendosPorEvolucao.set(a.evolucao_id, lista);
  }

  const sessions: SessionNote[] = sessaoRows.map((s) =>
    rowToSessionNote({ ...s, conteudo: decryptProntuario(s.conteudo) }, adendosPorEvolucao.get(s.id) ?? [])
  );

  return NextResponse.json({ sessions });
}
