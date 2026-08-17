import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SITE_URL } from "@/lib/site";

export type Crumb = { label: string; href?: string };

/**
 * Trilha de navegação com o JSON-LD (BreadcrumbList) junto: o Google usa a
 * marcação para trocar a URL crua do resultado de busca pelo caminho legível,
 * e a trilha visível resolve o mesmo problema pra quem chegou de link direto
 * e não sabe onde está. O último item é a página atual e vai sem href.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trilha: Crumb[] = [{ label: "Início", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trilha.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Você está aqui" className="mb-8">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          {trilha.map((item, i) => {
            const ultimo = i === trilha.length - 1;
            return (
              <li key={item.label} className="flex items-center gap-1.5">
                {item.href && !ultimo ? (
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-zinc-900 dark:hover:text-white"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={ultimo ? "page" : undefined}
                    className="font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {item.label}
                  </span>
                )}
                {!ultimo && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
