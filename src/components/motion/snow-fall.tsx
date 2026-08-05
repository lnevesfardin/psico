"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
};

/**
 * Partículas flutuando devagar atrás do conteúdo — deliberadamente lentas
 * e de baixo contraste: é ambientação, não animação de destaque.
 *
 * A cor sai da própria `color` computada do canvas, então o tema é
 * resolvido pelas classes Tailwind de quem chama (ex.: `text-brand-400/40
 * dark:text-white/25`) em vez de detectar dark mode em JS.
 *
 * Nada roda quando o usuário pede menos movimento (prefers-reduced-motion)
 * nem enquanto a aba está em segundo plano.
 */
export function SnowFall({
  className = "",
  count = 40,
}: {
  className?: string;
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let color = "rgba(148, 163, 130, 0.35)";

    function readColor() {
      color = getComputedStyle(canvas!).color || color;
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.floor(width * ratio);
      canvas!.height = Math.floor(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seed() {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 1 + Math.random() * 1.8,
        speed: 6 + Math.random() * 14, // px por segundo
        drift: 4 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.65,
      }));
    }

    let previous = performance.now();

    function tick(now: number) {
      // Delta em segundos: a queda fica igual em 60Hz e 144Hz.
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      context!.clearRect(0, 0, width, height);
      context!.fillStyle = color;

      for (const particle of particles) {
        particle.y += particle.speed * delta;
        particle.phase += delta;
        const x = particle.x + Math.sin(particle.phase) * particle.drift;

        if (particle.y - particle.radius > height) {
          particle.y = -particle.radius;
          particle.x = Math.random() * width;
        }

        context!.globalAlpha = particle.alpha;
        context!.beginPath();
        context!.arc(x, particle.y, particle.radius, 0, Math.PI * 2);
        context!.fill();
      }

      context!.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    function stop() {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    function handleResize() {
      resize();
      seed();
    }

    function handleVisibility() {
      if (document.hidden) stop();
      else start();
    }

    readColor();
    resize();
    seed();
    start();

    // A troca de tema muda a classe na <html>; relê a cor resolvida.
    const themeObserver = new MutationObserver(readColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    reduced.addEventListener("change", handleVisibility);

    return () => {
      stop();
      themeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      reduced.removeEventListener("change", handleVisibility);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 h-full w-full ${className}`}
    />
  );
}
