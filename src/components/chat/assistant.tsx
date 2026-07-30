"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";

type ChatMessage = { role: "user" | "model"; text: string };

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao consultar o assistente.");
      }
      setMessages((prev) => [...prev, { role: "model", text: data.text ?? "" }]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao consultar o assistente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:right-6">
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Assistente Psi Rob
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listRef}
            className="flex h-96 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Olá! Sou o assistente do Psi Rob. Posso ajudar você a usar a
                plataforma — agenda, pacientes, financeiro e mais. Como posso
                ajudar?
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "self-end bg-brand-600 text-white"
                    : "self-start bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 self-start rounded-2xl bg-zinc-100 px-3.5 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Digitando...
              </div>
            )}
          </div>

          {error && (
            <div className="mx-4 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={loading}
              className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-700 sm:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
