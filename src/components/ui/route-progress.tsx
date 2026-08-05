"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalNavClick(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0) return null;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;

  const anchor = (e.target as HTMLElement)?.closest?.("a");
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return null;
  if (/^[a-z]+:/i.test(href) && !href.startsWith(window.location.origin)) return null;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname + url.search === window.location.pathname + window.location.search) {
    return null;
  }
  return url.pathname + url.search;
}

function ProgressWatcher({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return null;
}

export function RouteProgress() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const growTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<string | null>(null);

  function clearTimers() {
    if (growTimer.current) clearInterval(growTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    growTimer.current = null;
    safetyTimer.current = null;
  }

  function start() {
    clearTimers();
    setVisible(true);
    setProgress(12);
    growTimer.current = setInterval(() => {
      setProgress((p) => (p < 85 ? p + (85 - p) * 0.1 : p));
    }, 200);
    // Trava de segurança: se por algum motivo a navegação nunca "terminar"
    // (erro silencioso, link pro mesmo destino, etc.), some sozinha.
    safetyTimer.current = setTimeout(() => finish(), 8000);
  }

  function finish() {
    clearTimers();
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const dest = isInternalNavClick(e);
      if (!dest) return;
      targetRef.current = dest;
      start();
    }
    // Fase de captura: precisa rodar ANTES do onClick do next/link, que fica
    // no alvo (fase de bubble) e chama preventDefault() — se ouvíssemos no
    // bubble em document (depois do alvo), e.defaultPrevented já estaria
    // true e a barra nunca disparava pra navegação nenhuma.
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <ProgressWatcher onDone={finish} />
      </Suspense>
      {visible && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent"
        >
          <div
            className="h-full bg-brand-600 shadow-[0_0_8px_rgba(0,0,0,0.15)] transition-[width] duration-200 ease-out dark:shadow-[0_0_8px_rgba(255,255,255,0.15)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  );
}
