import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEndereco } from "@/lib/format";
import { montarLembrete } from "@/lib/notificacoes/templates";
import { emailConfigurado, enviarEmail } from "@/lib/notificacoes/email";
import {
  enviarWebhook,
  webhookConfigurado,
  webhookUrl,
} from "@/lib/notificacoes/webhook";
import type {
  Canal,
  Destinatario,
  LembretePayload,
} from "@/lib/notificacoes/types";
import type { ModalidadeAtendimento } from "@/lib/dashboard-data";

/** Antecedência do lembrete. */
const ANTECEDENCIA_MIN = 60;
/**
 * Janela de planejamento: olha 2h à frente, não só a hora exata. Torna o
 * processo auto-recuperável (se o cron falhar algumas rodadas, a próxima
 * recupera) e cobre consultas marcadas em cima da hora — nesse caso
 * agendado_para já nasce no passado e o lembrete sai na mesma execução.
 */
const JANELA_MIN = 120;
const MAX_TENTATIVAS = 3;
const LOTE = 50;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function diaIso(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

type ConsultaRow = {
  id: string;
  psicologo_id: string;
  paciente_id: string | null;
  paciente_nome: string;
  data: string;
  horario: string;
  status: string;
  modalidade: ModalidadeAtendimento | null;
  email: string | null;
  cliente_id: string | null;
};

type PerfilRow = {
  id: string;
  nome: string;
  sala_online_url: string;
  tem_consultorio: boolean;
  consultorio_rua: string;
  consultorio_numero: string;
  consultorio_bairro: string;
  consultorio_cidade: string;
  consultorio_uf: string;
  consultorio_maps_url: string;
};

type NotificacaoRow = {
  id: string;
  consulta_id: string;
  canal: Canal;
  destino: string;
  payload: LembretePayload;
  tentativas: number;
};

function autorizado(request: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;

  const header = request.headers.get("authorization") ?? "";
  const recebido = header.startsWith("Bearer ") ? header.slice(7) : "";

  // timingSafeEqual exige buffers do mesmo tamanho — comparar o tamanho
  // antes evita a exceção e não vaza informação útil (o tamanho do segredo
  // não é o segredo).
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * consultas.data é `date` e consultas.horario é `time`, ambos sem fuso e
 * tratados como horário de Brasília pela aplicação inteira. Converte para
 * um Date real em UTC para poder comparar com "agora".
 */
function inicioDaConsulta(data: string, horario: string): Date {
  // Offset fixo -03:00: o Brasil não tem horário de verão desde 2019.
  return new Date(`${data}T${horario.slice(0, 5)}:00-03:00`);
}

function enderecoDoPerfil(perfil: PerfilRow): string | null {
  if (!perfil.tem_consultorio || !perfil.consultorio_rua) return null;
  return formatEndereco({
    rua: perfil.consultorio_rua,
    numero: perfil.consultorio_numero,
    bairro: perfil.consultorio_bairro,
    cidade: perfil.consultorio_cidade,
    uf: perfil.consultorio_uf,
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuração ausente." },
      { status: 503 }
    );
  }

  const agora = new Date();
  const limite = new Date(agora.getTime() + JANELA_MIN * 60_000);

  // ---------------------------------------------------------------
  // 1. Planejar: enfileira lembretes das consultas que começam em breve.
  // ---------------------------------------------------------------
  const { data: consultas, error: erroConsultas } = await supabase
    .from("consultas")
    .select(
      "id, psicologo_id, paciente_id, paciente_nome, data, horario, status, modalidade, email, cliente_id"
    )
    .eq("status", "confirmada")
    .eq("tipo", "consulta")
    // Folga de um dia para cada lado de propósito: "data" é uma data local
    // (Brasília) e toISOString() devolve UTC, então perto da meia-noite os
    // dois discordam em um dia. O recorte exato acontece logo abaixo, em JS,
    // já com o fuso resolvido — aqui só interessa reduzir o volume da query.
    .gte("data", diaIso(agora.getTime() - UM_DIA_MS))
    .lte("data", diaIso(limite.getTime() + UM_DIA_MS))
    .returns<ConsultaRow[]>();

  if (erroConsultas) {
    return NextResponse.json({ error: erroConsultas.message }, { status: 500 });
  }

  // Recorte exato da janela, com o fuso já resolvido.
  const naJanela = (consultas ?? []).filter((c) => {
    const inicio = inicioDaConsulta(c.data, c.horario);
    return inicio > agora && inicio <= limite;
  });

  let enfileirados = 0;

  if (naJanela.length > 0) {
    const psicologoIds = [...new Set(naJanela.map((c) => c.psicologo_id))];
    const clienteIds = [
      ...new Set(naJanela.map((c) => c.cliente_id).filter((id): id is string => !!id)),
    ];
    const pacienteIds = [
      ...new Set(naJanela.map((c) => c.paciente_id).filter((id): id is string => !!id)),
    ];

    const [{ data: perfis }, { data: profiles }, { data: pacientes }] =
      await Promise.all([
        supabase
          .from("perfis")
          .select(
            "id, nome, sala_online_url, tem_consultorio, consultorio_rua, consultorio_numero, consultorio_bairro, consultorio_cidade, consultorio_uf, consultorio_maps_url"
          )
          .in("id", psicologoIds)
          .returns<PerfilRow[]>(),
        supabase
          .from("profiles")
          .select("id, email")
          .in("id", [...psicologoIds, ...clienteIds])
          .returns<{ id: string; email: string }[]>(),
        pacienteIds.length > 0
          ? supabase
              .from("pacientes")
              .select("id, email")
              .in("id", pacienteIds)
              .returns<{ id: string; email: string | null }[]>()
          : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
      ]);

    const perfilPorId = new Map((perfis ?? []).map((p) => [p.id, p]));
    const emailPorId = new Map((profiles ?? []).map((p) => [p.id, p.email]));
    const emailPacientePorId = new Map(
      (pacientes ?? []).map((p) => [p.id, p.email])
    );

    const linhas: Record<string, unknown>[] = [];

    for (const consulta of naJanela) {
      const perfil = perfilPorId.get(consulta.psicologo_id);
      if (!perfil) continue;

      const agendadoPara = new Date(
        inicioDaConsulta(consulta.data, consulta.horario).getTime() -
          ANTECEDENCIA_MIN * 60_000
      );

      // Ordem de preferência do e-mail do paciente:
      // 1. o informado no próprio agendamento público (mais específico);
      // 2. o cadastro do paciente (caminho das consultas criadas à mão na
      //    Agenda, que não capturam e-mail);
      // 3. a conta do cliente, quando ele agendou logado.
      const emailPaciente =
        consulta.email ||
        (consulta.paciente_id ? emailPacientePorId.get(consulta.paciente_id) : null) ||
        (consulta.cliente_id ? emailPorId.get(consulta.cliente_id) : null) ||
        null;
      const emailPsicologo = emailPorId.get(consulta.psicologo_id) ?? null;

      const basePayload = {
        tipo: "lembrete_1h" as const,
        consultaId: consulta.id,
        data: consulta.data,
        horario: consulta.horario.slice(0, 5),
        modalidade: consulta.modalidade,
        pacienteNome: consulta.paciente_nome,
        psicologoNome: perfil.nome,
        salaUrl:
          consulta.modalidade === "online" && perfil.sala_online_url
            ? perfil.sala_online_url
            : null,
        enderecoConsultorio:
          consulta.modalidade === "presencial" ? enderecoDoPerfil(perfil) : null,
        mapsUrl:
          consulta.modalidade === "presencial" && perfil.tem_consultorio
            ? perfil.consultorio_maps_url || null
            : null,
      };

      const destinatarios: { quem: Destinatario; email: string | null }[] = [
        { quem: "paciente", email: emailPaciente },
        { quem: "psicologo", email: emailPsicologo },
      ];

      for (const { quem, email } of destinatarios) {
        const payload: LembretePayload = { ...basePayload, destinatario: quem };

        if (emailConfigurado() && email) {
          linhas.push({
            consulta_id: consulta.id,
            tipo: "lembrete_1h",
            destinatario: quem,
            canal: "email",
            destino: email,
            payload,
            agendado_para: agendadoPara.toISOString(),
          });
        }
        if (webhookConfigurado()) {
          linhas.push({
            consulta_id: consulta.id,
            tipo: "lembrete_1h",
            destinatario: quem,
            canal: "webhook",
            destino: webhookUrl(),
            payload,
            agendado_para: agendadoPara.toISOString(),
          });
        }
      }
    }

    if (linhas.length > 0) {
      // ignoreDuplicates: a constraint unique (consulta, tipo, destinatario,
      // canal) é o que garante que nada seja enfileirado duas vezes.
      const { data: inseridos } = await supabase
        .from("notificacoes")
        .upsert(linhas, {
          onConflict: "consulta_id,tipo,destinatario,canal",
          ignoreDuplicates: true,
        })
        .select("id");
      enfileirados = inseridos?.length ?? 0;
    }
  }

  // ---------------------------------------------------------------
  // 2. Despachar: envia o que já venceu.
  // ---------------------------------------------------------------
  const { data: pendentes, error: erroPendentes } = await supabase
    .from("notificacoes")
    .select("id, consulta_id, canal, destino, payload, tentativas")
    .eq("status", "pendente")
    .lte("agendado_para", agora.toISOString())
    .lt("tentativas", MAX_TENTATIVAS)
    .order("agendado_para")
    .limit(LOTE)
    .returns<NotificacaoRow[]>();

  if (erroPendentes) {
    return NextResponse.json({ error: erroPendentes.message }, { status: 500 });
  }

  let enviados = 0;
  let cancelados = 0;
  let falhas = 0;

  for (const notificacao of pendentes ?? []) {
    // A consulta pode ter sido desmarcada depois que o lembrete foi
    // enfileirado — revalidar evita avisar sobre sessão que não existe mais.
    const { data: consulta } = await supabase
      .from("consultas")
      .select("status")
      .eq("id", notificacao.consulta_id)
      .maybeSingle<{ status: string }>();

    if (!consulta || consulta.status !== "confirmada") {
      await supabase
        .from("notificacoes")
        .update({ status: "cancelado", erro: "Consulta não está mais confirmada." })
        .eq("id", notificacao.id);
      cancelados++;
      continue;
    }

    const resultado =
      notificacao.canal === "email"
        ? await enviarEmail(notificacao.destino, montarLembrete(notificacao.payload))
        : await enviarWebhook(notificacao.destino, notificacao.payload);

    if (resultado.ok) {
      await supabase
        .from("notificacoes")
        .update({
          status: "enviado",
          enviado_em: new Date().toISOString(),
          tentativas: notificacao.tentativas + 1,
          erro: null,
        })
        .eq("id", notificacao.id);
      enviados++;
    } else {
      const tentativas = notificacao.tentativas + 1;
      await supabase
        .from("notificacoes")
        .update({
          // Só desiste de vez no limite de tentativas; até lá continua
          // pendente para a próxima rodada do cron tentar de novo.
          status: tentativas >= MAX_TENTATIVAS ? "erro" : "pendente",
          tentativas,
          erro: resultado.erro,
        })
        .eq("id", notificacao.id);
      falhas++;
    }
  }

  // "consultasNaJanela" e "canais" existem para diagnóstico: sem eles,
  // enfileirados=0 é ambíguo (não há consulta próxima? ou nenhum canal está
  // configurado?) e só dá pra descobrir olhando o banco na mão.
  return NextResponse.json({
    enfileirados,
    enviados,
    cancelados,
    falhas,
    consultasNaJanela: naJanela.length,
    canais: { email: emailConfigurado(), webhook: webhookConfigurado() },
  });
}
