import { formatDateLabel } from "@/lib/format";
import type { CancelamentoPayload, LembretePayload } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Linhas de "onde é" — sala online ou endereço + Maps, conforme a modalidade. */
function linhasLocal(payload: LembretePayload): { label: string; valor: string; url?: string }[] {
  if (payload.modalidade === "online" && payload.salaUrl) {
    return [{ label: "Sala da videochamada", valor: payload.salaUrl, url: payload.salaUrl }];
  }
  if (payload.modalidade === "presencial" && payload.enderecoConsultorio) {
    const linhas: { label: string; valor: string; url?: string }[] = [
      { label: "Endereço", valor: payload.enderecoConsultorio },
    ];
    if (payload.mapsUrl) {
      linhas.push({ label: "Como chegar", valor: "Ver no Google Maps", url: payload.mapsUrl });
    }
    return linhas;
  }
  return [];
}

export type Mensagem = { assunto: string; html: string; texto: string };

export function montarLembrete(payload: LembretePayload): Mensagem {
  const quandoLegivel = `${formatDateLabel(payload.data)} às ${payload.horario}`;
  const paraPaciente = payload.destinatario === "paciente";

  const saudacao = paraPaciente
    ? `Olá, ${payload.pacienteNome}!`
    : `Olá, ${payload.psicologoNome}!`;

  const abertura = paraPaciente
    ? `Passando para lembrar da sua consulta com ${payload.psicologoNome}, que começa em cerca de 1 hora.`
    : `Passando para lembrar da sua sessão com ${payload.pacienteNome}, que começa em cerca de 1 hora.`;

  const modalidadeLegivel =
    payload.modalidade === "online"
      ? "Online"
      : payload.modalidade === "presencial"
        ? "Presencial"
        : null;

  const itens: { label: string; valor: string; url?: string }[] = [
    { label: "Quando", valor: quandoLegivel },
    ...(modalidadeLegivel ? [{ label: "Modalidade", valor: modalidadeLegivel }] : []),
    ...linhasLocal(payload),
  ];

  const assunto = paraPaciente
    ? `Lembrete: sua consulta é às ${payload.horario}`
    : `Lembrete: sessão com ${payload.pacienteNome} às ${payload.horario}`;

  const texto = [
    saudacao,
    "",
    abertura,
    "",
    ...itens.map((i) => `${i.label}: ${i.url ?? i.valor}`),
    "",
    "— Psico",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${escapeHtml(saudacao)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(abertura)}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;">
        ${itens
          .map(
            (i) => `<tr>
          <td style="padding:8px 0;color:#71717a;width:40%;vertical-align:top;">${escapeHtml(i.label)}</td>
          <td style="padding:8px 0;font-weight:600;">${
            i.url
              ? `<a href="${escapeHtml(i.url)}" style="color:#5c7143;">${escapeHtml(i.valor)}</a>`
              : escapeHtml(i.valor)
          }</td>
        </tr>`
          )
          .join("")}
      </table>
      <p style="margin:28px 0 0;font-size:13px;color:#a1a1aa;">
        Você recebeu este e-mail porque tem uma consulta agendada no Psico.
      </p>
    </div>
  </body>
</html>`;

  return { assunto, html, texto };
}

export function montarCancelamento(payload: CancelamentoPayload): Mensagem {
  const quandoLegivel = `${formatDateLabel(payload.data)} às ${payload.horario}`;
  const assunto = `${payload.pacienteNome} cancelou a consulta de ${quandoLegivel}`;

  const texto = [
    `Olá, ${payload.psicologoNome}!`,
    "",
    `${payload.pacienteNome} cancelou a consulta marcada para ${quandoLegivel}.`,
    "",
    `Motivo informado: ${payload.motivo}`,
    "",
    "— Psico",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;">Olá, ${escapeHtml(payload.psicologoNome)}!</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">
        <strong>${escapeHtml(payload.pacienteNome)}</strong> cancelou a consulta marcada para <strong>${escapeHtml(quandoLegivel)}</strong>.
      </p>
      <div style="border-radius:12px;background:#fef2f2;padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#b91c1c;">Motivo informado</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(payload.motivo)}</p>
      </div>
      <p style="margin:28px 0 0;font-size:13px;color:#a1a1aa;">
        Você recebeu este e-mail porque tem uma consulta agendada no Psico.
      </p>
    </div>
  </body>
</html>`;

  return { assunto, html, texto };
}
