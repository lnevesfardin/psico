"use client";

import { useEffect } from "react";
import { reportarErro } from "@/lib/erros-client";

/**
 * Último recurso: erro no próprio layout raiz, onde error.tsx não roda.
 * Substitui <html>/<body> inteiros, então não dá pra reaproveitar nada do
 * layout — nem a fonte, nem o Tailwind carregado por ele. Daí o estilo
 * inline, que é o que sobra funcionando quando tudo mais falhou.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    reportarErro(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#18181b",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700 }}>
            Algo deu errado
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#71717a" }}>
            O problema foi registrado automaticamente. Recarregue a página para
            tentar de novo.
          </p>
          {/* <a> puro, não <Link>: aqui a árvore React da raiz já quebrou, e
              navegação client-side continuaria dentro dela. Só uma recarga
              de documento inteiro devolve a aplicação a um estado sadio. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              borderRadius: "9999px",
              background: "#4d7c4d",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Voltar ao início
          </a>
        </div>
      </body>
    </html>
  );
}
