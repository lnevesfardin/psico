import type { Metadata } from "next";

// A página é Client Component (formulário), e Client Component não exporta
// metadata — daí este layout só pra dar título e description próprios a ela.
export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Receba um link por e-mail para criar uma nova senha da sua conta do Psico.",
  robots: { index: false, follow: true },
};

export default function RecuperarSenhaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
