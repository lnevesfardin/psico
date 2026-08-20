"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  radius: number;
  label: string;
  pulse: number;
};

/**
 * Fundo decorativo animado: uma malha de pontos que reage ao mouse com uma
 * simulação simples de mola (Hooke) — o ponto se afasta do cursor e volta
 * sozinho pra posição de origem.
 *
 * Adaptado de um componente de demonstração genérico para servir como CAMADA
 * DE FUNDO de uma seção existente, não como tela cheia com título próprio:
 *
 * - Se dimensiona pelo elemento PAI (ResizeObserver), não por window.innerWidth
 *   /innerHeight — assim funciona dentro de qualquer seção, do tamanho dela.
 * - O mouse é lido relativo ao próprio canvas (getBoundingClientRect), não
 *   direto de clientX/clientY — sem isso a interação ficava desalinhada
 *   sempre que o canvas não começa no topo da página (aqui ele fica dentro do
 *   hero, abaixo do cabeçalho fixo).
 * - ctx.scale(dpr, dpr) do original era chamado de novo a cada redimensionamento
 *   e ACUMULAVA a escala (zoom crescente a cada resize). Trocado por
 *   setTransform, que define a escala em vez de multiplicar.
 * - Tema segue o "dark" da própria página (o mesmo evento "themechange" que o
 *   ThemeToggle já dispara), não prefers-color-scheme do sistema — o usuário
 *   pode ter trocado o tema manualmente, e o fundo precisa acompanhar essa
 *   escolha, não a do sistema operacional.
 * - Cores vêm da paleta da marca (verde-oliva), não do azul genérico do
 *   componente original.
 * - Não roda em prefers-reduced-motion nem em telas de toque: é decoração
 *   pura, sem ganho nenhum de UX num celular (sem cursor pairando) e potencial
 *   gatilho de enjoo em quem pediu menos movimento.
 * - pointer-events-none: nunca deve interceptar clique de nada por cima.
 */
export function ConstellationGrid({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const reduzMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const semCursor = window.matchMedia("(pointer: coarse)").matches;
    if (reduzMovimento || semCursor) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let escuro = document.documentElement.classList.contains("dark");

    const mouse = {
      x: -1000,
      y: -1000,
      prevX: -1000,
      prevY: -1000,
      vx: 0,
      vy: 0,
      radius: 200,
    };

    function initNodes() {
      nodes = [];
      const spacing = 60;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          nodes.push({
            x,
            y,
            vx: 0,
            vy: 0,
            baseX: x,
            baseY: y,
            radius: Math.random() * 1.2 + 1.2,
            label: `${(i * 7).toString(16).toUpperCase()}:${(j * 11).toString(16).toUpperCase()}`,
            pulse: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    function handleResize() {
      if (!container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      // "!": mesmo caso de ctx! logo abaixo — o guard no topo do efeito já
      // garante que canvas não é nulo, mas o TS não propaga essa checagem
      // para dentro de function declarations aninhadas (são hoisted).
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes();
    }

    function handleMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function handleMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    function handleTemaMudou() {
      escuro = document.documentElement.classList.contains("dark");
    }

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("themechange", handleTemaMudou);

    let lastTime = performance.now();

    function render(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      mouse.vx = (mouse.x - mouse.prevX) / (dt * 1000 || 1);
      mouse.vy = (mouse.y - mouse.prevY) / (dt * 1000 || 1);
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);

      // Paleta da marca: verde-oliva no lugar do ciano genérico do original.
      const bgColor = escuro ? "#0d1117" : "#ffffff";
      const nodeColor = escuro ? "244, 244, 245" : "24, 24, 27";
      const accentColor = escuro ? "179, 195, 154" : "92, 113, 67";

      ctx!.fillStyle = bgColor;
      ctx!.fillRect(0, 0, width, height);

      const SPRING_K = 18;
      const DAMPING = 0.82;

      for (const n of nodes) {
        n.pulse += dt * 3;

        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius && dist > 0) {
          const power = 1 - dist / mouse.radius;
          const force = power * (1200 + speed * 120);
          const angle = Math.atan2(dy, dx);
          n.vx -= Math.cos(angle) * force * dt;
          n.vy -= Math.sin(angle) * force * dt;
        }

        n.vx += (n.baseX - n.x) * SPRING_K * dt;
        n.vy += (n.baseY - n.y) * SPRING_K * dt;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx * dt * 60;
        n.y += n.vy * dt * 60;
      }

      const MAX_CONN_DIST = 78;
      const MAX_CONN_DIST_SQ = MAX_CONN_DIST * MAX_CONN_DIST;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const ndx = n.x - n2.x;
          const ndy = n.y - n2.y;
          const distSq = ndx * ndx + ndy * ndy;
          if (distSq < MAX_CONN_DIST_SQ) {
            const nDist = Math.sqrt(distSq);
            // Alpha mais baixo que o original: aqui é fundo atrás de texto
            // real, não a atração principal da tela.
            const alpha = (1 - nDist / MAX_CONN_DIST) * (escuro ? 0.16 : 0.08);
            ctx!.strokeStyle = `rgba(${nodeColor}, ${alpha})`;
            ctx!.lineWidth = 0.7;
            ctx!.beginPath();
            ctx!.moveTo(n.x, n.y);
            ctx!.lineTo(n2.x, n2.y);
            ctx!.stroke();
          }
        }
      }

      for (const n of nodes) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isNear = dist < mouse.radius;

        const baseAlpha = isNear ? 0.9 : 0.2 + Math.sin(n.pulse) * 0.06;
        ctx!.fillStyle = isNear
          ? `rgba(${accentColor}, ${baseAlpha})`
          : `rgba(${nodeColor}, ${baseAlpha})`;

        const currentRadius = isNear
          ? n.radius * 2.2
          : n.radius + Math.sin(n.pulse) * 0.3;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, Math.max(0.5, currentRadius), 0, Math.PI * 2);
        ctx!.fill();

        if (dist < 85) {
          const pulseRing = ((n.pulse * 20) % 30) + 4;
          const ringAlpha = (1 - pulseRing / 34) * 0.35;
          ctx!.strokeStyle = `rgba(${accentColor}, ${ringAlpha})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, pulseRing, 0, Math.PI * 2);
          ctx!.stroke();

          ctx!.font = "8px ui-monospace, SFMono-Regular, Consolas, monospace";
          ctx!.fillStyle = `rgba(${accentColor}, 0.75)`;
          ctx!.fillText(n.label, n.x + 10, n.y - 10);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("themechange", handleTemaMudou);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export default ConstellationGrid;
