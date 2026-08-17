import type { Metadata } from "next";

// Mesmo motivo do layout de /recuperar-senha: a página é Client Component.
export const metadata: Metadata = {
  title: "Redefinir senha",
  description: "Defina uma nova senha para a sua conta do Psico.",
  robots: { index: false, follow: false },
};

export default function RedefinirSenhaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
