/**
 * Dados canônicos do site, usados por metadata, robots, sitemap e JSON-LD —
 * um lugar só pra não haver título/URL divergindo entre eles.
 *
 * A URL vem de NEXT_PUBLIC_SITE_URL pra não travar o domínio no código: no
 * dia que sair do domínio da Vercel, basta trocar a variável de ambiente.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://psico-psi-two.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Psico";

export const SITE_DESCRIPTION =
  "Prontuário eletrônico, agenda online, gestão de pacientes e financeiro em um só sistema, feito para consultórios de psicologia.";

/** Compromisso de atendimento exibido na landing e no FAQ. */
export const RESPOSTA_PROMESSA = "Resposta no mesmo dia útil";
