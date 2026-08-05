"use client";

import { useEffect, type RefObject } from "react";

type Options = {
  enabled?: boolean;
  /** Peso de repouso; o padrão casa com o `font-weight: bold` do body. */
  base?: number;
  /** Peso no ponto exato do cursor. */
  peak?: number;
  /** Raio de influência em px. */
  radius?: number;
};

/**
 * Engrossa as letras conforme o cursor se aproxima delas, escrevendo
 * `font-variation-settings` direto no DOM — sem estado do React, então
 * mover o mouse não re-renderiza a árvore.
 *
 * Depende do eixo "wght" da Montserrat variável (ver src/app/layout.tsx:
 * next/font sem `weight` carrega a versão variável). Atua sobre os
 * elementos marcados com `data-weight-char` dentro do container.
 */
export function useWeightHover(
  containerRef: RefObject<HTMLElement | null>,
  { enabled = true, base = 700, peak = 900, radius = 120 }: Options = {}
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    // Só faz sentido com mouse de verdade: em touch não existe hover, e o
    // efeito ficaria "grudado" onde o dedo tocou por último.
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reduced.matches) return;

    const chars = Array.from(
      container.querySelectorAll<HTMLElement>("[data-weight-char]")
    );
    if (chars.length === 0) return;

    // Cache dos retângulos: getBoundingClientRect por letra a cada frame
    // causaria layout thrashing num título inteiro. Invalidado em
    // scroll/resize, que são as únicas coisas que movem as letras.
    let rects: DOMRect[] | null = null;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    function paint() {
      frame = 0;
      if (!rects) rects = chars.map((char) => char.getBoundingClientRect());
      const point = pointer;

      chars.forEach((char, i) => {
        if (!point) {
          char.style.fontVariationSettings = "";
          return;
        }
        const rect = rects![i];
        const dx = point.x - (rect.left + rect.width / 2);
        const dy = point.y - (rect.top + rect.height / 2);
        const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
        // Quadrática: mantém o efeito concentrado embaixo do cursor em vez
        // de engrossar meia frase de uma vez.
        const weight = Math.round(base + (peak - base) * proximity * proximity);
        char.style.fontVariationSettings = `"wght" ${weight}`;
      });
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(paint);
    }

    function handleMove(event: PointerEvent) {
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    }

    function handleLeave() {
      pointer = null;
      schedule();
    }

    function invalidate() {
      rects = null;
      schedule();
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    document.addEventListener("pointerleave", handleLeave);
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", handleLeave);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      if (frame) cancelAnimationFrame(frame);
      chars.forEach((char) => {
        char.style.fontVariationSettings = "";
      });
    };
  }, [containerRef, enabled, base, peak, radius]);
}
