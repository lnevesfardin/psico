import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export const metadata: Metadata = {
  title: "Entrar",
  description:
    "Acesse sua conta do Psico para ver sua agenda, seus pacientes e seus prontuários.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthSplitLayout
      title="Acesse seu painel"
      description="Entre com seu email e senha para continuar."
    >
      <AuthForm mode="login" initialError={error} />
    </AuthSplitLayout>
  );
}
