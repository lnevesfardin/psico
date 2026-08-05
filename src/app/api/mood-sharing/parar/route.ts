import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { montarParouCompartilharHumor } from "@/lib/notificacoes/templates";
import { emailConfigurado, enviarEmail } from "@/lib/notificacoes/email";

type RpcRow = {
  psicologo_email: string | null;
  psicologo_nome: string | null;
  paciente_nome: string;
};

/**
 * Cliente para de compartilhar o check-in de humor com um psicólogo (desfaz
 * pacientes.cliente_user_id) e avisa por e-mail. A mutação roda aqui, não
 * client-side, porque o cliente não tem (e não deve ter) SELECT em
 * "pacientes" pra re-verificar o motivo depois — a função
 * parar_compartilhar_humor já faz a checagem de dono (cliente_user_id =
 * auth.uid()) e devolve os dados do e-mail no mesmo passo, tudo dentro desta
 * chamada autenticada por cookie.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pacienteId = body?.pacienteId;
  if (!pacienteId || typeof pacienteId !== "string") {
    return NextResponse.json({ error: "pacienteId é obrigatório." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .rpc("parar_compartilhar_humor", { p_paciente_id: pacienteId })
    .maybeSingle<RpcRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
  }

  if (emailConfigurado() && data.psicologo_email) {
    const resultado = await enviarEmail(
      data.psicologo_email,
      montarParouCompartilharHumor({
        psicologoNome: data.psicologo_nome ?? "",
        pacienteNome: data.paciente_nome,
      })
    );
    if (!resultado.ok) {
      // O vínculo já foi desfeito no banco, que é o que importa pro
      // cliente — falha no e-mail não deve impedir a resposta de sucesso.
      console.error(
        "Falha ao notificar psicólogo sobre humor não compartilhado:",
        resultado.erro
      );
    }
  }

  return NextResponse.json({ ok: true });
}
