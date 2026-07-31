"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

// Evento próprio: dispara sempre que o tema muda (inclusive pelo próprio
// clique no toggle) para que useSyncExternalStore saiba re-renderizar —
// mutar classList direto não notifica React sozinho.
function subscribe(callback: () => void) {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
  window.dispatchEvent(new Event("themechange"));
}

export function ThemeToggle() {
  // O script em layout.tsx já aplicou a classe "dark" antes da hidratação —
  // useSyncExternalStore lê esse estado real do DOM sem causar mismatch
  // entre servidor e cliente (mesmo padrão de useOrigin em dashboard/link).
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light");

  return (
    <div
      role="group"
      aria-label="Tema"
      className="inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <button
        type="button"
        onClick={() => applyTheme("light")}
        aria-pressed={theme === "light"}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
          theme === "light"
            ? "bg-brand-600 text-white"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Claro</span>
      </button>
      <button
        type="button"
        onClick={() => applyTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
          theme === "dark"
            ? "bg-brand-600 text-white"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Escuro</span>
      </button>
    </div>
  );
}
