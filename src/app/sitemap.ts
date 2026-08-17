import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Só as páginas públicas e estáveis. Rotas com token ou dado de paciente
 * ficam fora pelo mesmo motivo do robots.ts, e /agendar/[psicologoId] fica
 * fora por ser link que o profissional divulga por conta própria.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1, lastModified: agora },
    {
      url: `${SITE_URL}/cadastro`,
      changeFrequency: "monthly",
      priority: 0.8,
      lastModified: agora,
    },
    {
      url: `${SITE_URL}/login`,
      changeFrequency: "yearly",
      priority: 0.5,
      lastModified: agora,
    },
    {
      url: `${SITE_URL}/termos`,
      changeFrequency: "yearly",
      priority: 0.3,
      lastModified: agora,
    },
    {
      url: `${SITE_URL}/privacidade`,
      changeFrequency: "yearly",
      priority: 0.3,
      lastModified: agora,
    },
  ];
}
