"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listAvisos,
  marcarAvisoLido,
  marcarTodosAvisosLidos,
  verificarRevisoesPendentes,
  type Aviso,
} from "@/lib/avisos-client";
import { formatDateTime, todayIso } from "@/lib/format";

export function NotificationBell() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    verificarRevisoesPendentes(supabase, todayIso())
      .catch(() => {})
      .finally(() => {
        listAvisos(supabase)
          .then(setAvisos)
          .catch(() => {});
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = avisos.filter((a) => !a.lido).length;

  async function handleMarkRead(aviso: Aviso) {
    if (aviso.lido) return;
    setAvisos((prev) => prev.map((a) => (a.id === aviso.id ? { ...a, lido: true } : a)));
    try {
      const supabase = createClient();
      await marcarAvisoLido(supabase, aviso.id);
    } catch {
      setAvisos((prev) => prev.map((a) => (a.id === aviso.id ? { ...a, lido: false } : a)));
    }
  }

  async function handleMarkAllRead() {
    setAvisos((prev) => prev.map((a) => ({ ...a, lido: true })));
    try {
      const supabase = createClient();
      await marcarTodosAvisosLidos(supabase);
    } catch {
      // Sem rollback granular aqui: o pior caso é reabrir e ver os mesmos
      // avisos "lidos" que na verdade não foram — inofensivo, o próximo
      // fetch da lista corrige sozinho.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Avisos"
        className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-zinc-100 bg-white shadow-lg md:left-0 md:right-auto dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">Avisos</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {avisos.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
                Nenhum aviso por aqui.
              </p>
            ) : (
              avisos.map((aviso) => (
                <button
                  key={aviso.id}
                  type="button"
                  onClick={() => handleMarkRead(aviso)}
                  className={`flex w-full flex-col items-start gap-1 border-b border-zinc-50 px-4 py-3 text-left last:border-b-0 dark:border-zinc-800/60 ${
                    aviso.lido
                      ? "bg-transparent"
                      : "bg-brand-50/60 dark:bg-brand-950/30"
                  }`}
                >
                  <div className="flex w-full items-start gap-2">
                    {!aviso.lido && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                    )}
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{aviso.mensagem}</p>
                  </div>
                  <span className="pl-3.5 text-xs text-zinc-400 dark:text-zinc-600">
                    {formatDateTime(aviso.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
