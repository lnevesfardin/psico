import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { montarCancelamento } from "@/lib/notificacoes/templates";
import { emailConfigurado, enviarEmail } from "@/lib/notificacoes/email";

type ConsultaRow = {
  id: string;
  psicologo_id: string;
  cliente_id: string | null;
  paciente_nome: string;
  data: string;
  horario: string;
  status: string;
  motivo_cancelamento: string | null;
};

/**
 * Dispara o aviso por e-mail pro psicólogo quando o cliente cancela uma
 * consulta (chamado logo depois de cancelar_consulta_cliente, ver
 * lib/client-appointments-client.ts). Recebe só o id — nunca confia em
 * nome/motivo vindos do corpo da requisição, tudo é relido do banco com a
 * sessão do próprio chamador (RLS garante que só vê a própria consulta).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const consultaId = body?.consultaId;
  if (!consultaId || typeof consultaId !== "string") {
    return NextResponse.json({ error: "consultaId é obrigatório." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: consulta } = await supabase
    .from("consultas")
    .select("id, psicologo_id, cliente_id, paciente_nome, data, horario, status, motivo_cancelamento")
    .eq("id", consultaId)
    .maybeSingle<ConsultaRow>();

  if (!consulta || consulta.cliente_id !== user.id) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }
  if (consulta.status !== "desmarcada" || !consulta.motivo_cancelamento) {
    return NextResponse.json(
      { error: "Este agendamento não foi cancelado com motivo." },
      { status: 400 }
    );
  }

  if (!emailConfigurado()) {
    return NextResponse.json({ ok: true, skipped: "email-nao-configurado" });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: true, skipped: "admin-nao-configurado" });
  }

  // profiles (não perfis): é lá que mora o e-mail de login, RLS-restrito a
  // "auth.uid() = id" — só a service role (admin) lê o e-mail de outro
  // usuário, mesmo padrão do despachante de lembretes.
  const { data: perfil } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", consulta.psicologo_id)
    .maybeSingle<{ email: string | null; name: string | null }>();

  if (!perfil?.email) {
    return NextResponse.json({ ok: true, skipped: "psicologo-sem-email" });
  }

  const resultado = await enviarEmail(
    perfil.email,
    montarCancelamento({
      psicologoNome: perfil.name ?? "",
      pacienteNome: consulta.paciente_nome,
      data: consulta.data,
      horario: consulta.horario.slice(0, 5),
      motivo: consulta.motivo_cancelamento,
    })
  );

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.erro }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
