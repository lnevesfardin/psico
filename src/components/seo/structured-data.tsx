import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Marcação de negócio da home. Não é LocalBusiness de propósito: o Psico é
 * um sistema web vendido para psicólogos de todo o país, sem endereço que
 * receba público — LocalBusiness sem endereço real seria marcação falsa, que
 * o Google penaliza. SoftwareApplication + Organization é o par que descreve
 * um SaaS, e o FAQPage é o que pode render o acordeão direto na busca.
 *
 * Os preços vêm dos mesmos planos exibidos na página; se mudarem lá, mudar
 * aqui — marcação de preço divergente do site é motivo de penalização.
 */
export function StructuredData({
  faq,
}: {
  faq: { question: string; answer: string }[];
}) {
  const organizacao = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organizacao`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: SITE_DESCRIPTION,
    areaServed: { "@type": "Country", name: "Brasil" },
  };

  const aplicacao = {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Prontuário eletrônico e gestão de consultório",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organizacao` },
    offers: [
      {
        "@type": "Offer",
        name: "Mensal",
        price: "49.00",
        priceCurrency: "BRL",
        category: "Assinatura mensal",
      },
      {
        "@type": "Offer",
        name: "Trimestral",
        price: "135.00",
        priceCurrency: "BRL",
        category: "Assinatura trimestral",
      },
      {
        "@type": "Offer",
        name: "Anual",
        price: "468.00",
        priceCurrency: "BRL",
        category: "Assinatura anual",
      },
    ],
  };

  const perguntas = {
    "@type": "FAQPage",
    mainEntity: faq.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizacao, aplicacao, perguntas],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
