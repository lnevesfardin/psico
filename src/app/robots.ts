import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * O que fica de fora do índice não é escolha de SEO, é LGPD: /convite e
 * /escala carregam token na URL e expõem nome de paciente e vínculo com o
 * psicólogo; /dashboard e /agendamentos são área logada. Indexar qualquer
 * um deles publicaria dado sensível de saúde no Google.
 *
 * /agendar fica liberado de propósito: é o link público que o psicólogo
 * escolhe divulgar, e mostra só os dados profissionais dele.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/agendamentos/",
        "/convite/",
        "/escala/",
        "/onboarding/",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
