import Link from "next/link";

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 dark:bg-ink-950 dark:text-zinc-50">
      <header className="border-b border-zinc-100 px-6 py-5 dark:border-white/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6 dark:invert" />
            Psi Rob
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </header>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
      <footer className="border-t border-zinc-100 px-6 py-8 text-center text-sm text-zinc-500 dark:border-white/5 dark:text-zinc-500">
        © {new Date().getFullYear()} Psi Rob. Todos os direitos reservados.
      </footer>
    </div>
  );
}
