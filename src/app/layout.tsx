import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

// Gotham é uma fonte paga (não está no Google Fonts) — Montserrat é a
// substituta gratuita mais usada no lugar dela, com a mesma construção
// geométrica. Aplicada em --font-sans, que é o que tanto o body quanto os
// wrappers com classe "font-sans" nas páginas usam — cobre o site inteiro.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Psi Rob",
  description: "Gestão de consultório de psicologia sem complicação.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Aplica a classe "dark" antes da primeira pintura, direto do
            localStorage (com fallback pra preferência do sistema no
            primeiro acesso) — sem isso a página piscaria clara antes de
            trocar pro tema salvo. suppressHydrationWarning na <html> evita
            o aviso de mismatch por essa mutação acontecer fora do React. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  var t = localStorage.getItem('theme');
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}`,
          }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
