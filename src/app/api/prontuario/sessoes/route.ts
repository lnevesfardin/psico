import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptProntuario } from "@/lib/crypto/prontuario-crypto";
import { rowToSessionNote, SESSAO_COLUMNS, type SessaoRow } from "@/lib/prontuario/mapping";
import type { FormatoEvolucao } from "@/lib/dashboard-data";

type SessionNoteOriginBody =
  | { origem: "manual" }
  | { origem: "transcricao"; consentimentoEm: string; duracaoSegundos: number };

/**
 * Cria um rascunho de evolução. Passa pela rota (não insert direto do
 * client) porque "conteudo" precisa ser cifrado antes de chegar no banco
 * (ver src/lib/crypto/prontuario-crypto.ts) — a chave só existe no
 * servidor. RLS continua sendo quem decide se o insert é permitido: este
 * handler usa o client autenticado por cookie (mesma sessão do navegador),
 * não a service role.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const {
    patientId,
    content,
    formato,
    origin,
    agendamentoId,
    geradoPorIa,
  } = (body ?? {}) as {
    patientId?: string;
    content?: string;
    formato?: FormatoEvolucao;
    origin?: SessionNoteOriginBody;
    agendamentoId?: string | null;
    geradoPorIa?: boolean;
  };

  if (!patientId || typeof content !== "string" || !content.trim() || !formato) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const origem = origin?.origem ?? "manual";

  const { data, error } = await supabase
    .from("sessoes_prontuario")
    .insert({
      paciente_id: patientId,
      conteudo: encryptProntuario(content),
      formato,
      agendamento_id: agendamentoId ?? null,
      origem,
      gerado_por_ia: geradoPorIa ?? false,
      ...(origin?.origem === "transcricao"
        ? {
            consentimento_em: origin.consentimentoEm,
            duracao_segundos: origin.duracaoSegundos,
          }
        : {}),
    })
    .select(SESSAO_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Devolve o conteúdo em claro (já temos ele, não precisa decifrar de
  // volta) pra UI atualizar sem outra viagem ao servidor.
  const row = data as SessaoRow;
  const session = rowToSessionNote({ ...row, conteudo: content });
  return NextResponse.json({ session });
}
