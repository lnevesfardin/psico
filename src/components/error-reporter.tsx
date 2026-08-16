"use client";

import { useEffect } from "react";
import { reportarErro } from "@/lib/erros-client";

/**
 * Captura o que escapa dos error boundaries do React: exceção solta em
 * handler de evento, promise rejeitada sem catch, erro dentro de callback de
 * timer. Montado uma vez na raiz — vale pro site inteiro, inclusive as
 * páginas públicas, onde ninguém está logado pra reclamar.
 */
export function ErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportarErro(event.error ?? event.message);
    }
    function onRejection(event: PromiseRejectionEvent) {
      reportarErro(event.reason);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
