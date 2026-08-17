import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RouteProgress } from "@/components/ui/route-progress";
import { ErrorReporter } from "@/components/error-reporter";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Aplicada em --font-sans, que é o que tanto o body quanto os wrappers com
// classe "font-sans" nas páginas usam — cobre o site inteiro.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // template dá título único a cada página sem repetir a marca em todo
  // arquivo; "default" é o que a home usa, com a palavra-chave na frente.
  title: {
    default: "Psico — Sistema para consultório de psicologia",
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: SITE_NAME,
    title: "Psico — Sistema para consultório de psicologia",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Psico — Sistema para consultório de psicologia",
    description: SITE_DESCRIPTION,
  },
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
      className={`${plusJakartaSans.variable} h-full antialiased`}
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
        <RouteProgress />
        <ErrorReporter />
        <AuthProvider>{children}</AuthProvider>
        {/* Flutuante e único para o site inteiro (landing, área do cliente
            e do psicólogo) — evita duplicar o toggle em cada header/sidebar. */}
        <div className="fixed bottom-4 left-4 z-40">
          <ThemeToggle />
        </div>
        {/* Vercel Analytics no lugar do Google Analytics: mede visita e
            origem sem cookie e sem enviar dado a terceiro — o que importa
            num site que fala de saúde e responde por LGPD. */}
        <Analytics />
      </body>
    </html>
  );
}
