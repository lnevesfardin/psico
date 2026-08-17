import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ConviteRow = { paciente_id: string };

/**
 * Cria a conta do paciente já com o e-mail confirmado, pulando o código de
 * verificação. "Confirm email" no Supabase é uma chave global do projeto —
 * não dá pra exigir do psicólogo e dispensar do paciente pelo painel, então
 * a conta de cliente nasce pela service role com email_confirm: true.
 *
 * O que autoriza pular a verificação é o token do convite: ele foi gerado
 * pelo psicólogo na ficha daquele paciente e entregue por fora (WhatsApp,
 * pessoalmente), o que já prova o vínculo — o e-mail aqui serve pra logar,
 * não pra provar quem é a pessoa. role é fixado em "client" no servidor
 * para o corpo da requisição não conseguir escalar pra "psychologist".
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const telefone = typeof body?.telefone === "string" ? body.telefone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || !name || !telefone || !email || !password) {
    return NextResponse.json(
      { error: "Preencha todos os campos para criar sua conta." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Cadastro indisponível no momento. Avise seu psicólogo." },
      { status: 503 }
    );
  }

  const conviteInvalido = NextResponse.json(
    { error: "Este convite não é mais válido. Peça um novo link ao seu psicólogo." },
    { status: 400 }
  );

  const { data: convite } = await admin
    .from("convites_paciente")
    .select("paciente_id")
    .eq("token", token)
    .is("aceito_em", null)
    .maybeSingle<ConviteRow>();

  if (!convite) return conviteInvalido;

  // Ficha já com conta vinculada não pode gerar outra: evita criar um usuário
  // órfão que nunca conseguiria aceitar o convite.
  const { data: paciente } = await admin
    .from("pacientes")
    .select("cliente_user_id")
    .eq("id", convite.paciente_id)
    .maybeSingle<{ cliente_user_id: string | null }>();

  if (!paciente || paciente.cliente_user_id) return conviteInvalido;

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "client", telefone },
  });

  if (error) {
    // O vínculo com a ficha ainda não foi feito (isso é aceitar_convite_paciente,
    // já com a sessão do próprio usuário) — a página tenta logar com a senha
    // digitada e seguir dali, cobrindo quem recarregou no meio do cadastro.
    const jaExiste =
      error.status === 422 || /already been registered|already exists/i.test(error.message);
    if (jaExiste) {
      return NextResponse.json(
        {
          error: "Já existe uma conta com esse e-mail.",
          code: "email-em-uso",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível criar a conta. Tente novamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
