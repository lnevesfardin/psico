"use client";

import { useEffect, useRef, useState } from "react";

type Fase = "inspirar" | "segurar" | "expirar";

const ROTULO: Record<Fase, string> = {
  inspirar: "Puxe o ar...",
  segurar: "Segure...",
  expirar: "Solte devagar...",
};

/**
 * Círculo que cresce e encolhe no ritmo da respiração, com o texto da fase
 * no meio. A animação é a atividade em si: quem acompanha o desenho respira
 * no ritmo sem precisar contar.
 *
 * Chama onConcluir() ao terminar os ciclos, mas o botão de seguir aparece
 * antes disso também — ninguém deve ficar preso numa tela de respiração se
 * quiser sair.
 */
export function RespiracaoGuiada({
  ciclos,
  inspirar,
  segurar,
  expirar,
  onConcluir,
}: {
  ciclos: number;
  inspirar: number;
  segurar: number;
  expirar: number;
  onConcluir: () => void;
}) {
  const [rodando, setRodando] = useState(false);
  const [fase, setFase] = useState<Fase>("inspirar");
  const [restante, setRestante] = useState(inspirar);
  const [cicloAtual, setCicloAtual] = useState(0);
  const concluidoRef = useRef(false);

  useEffect(() => {
    if (!rodando) return;

    const id = setInterval(() => {
      setRestante((segundos) => {
        if (segundos > 1) return segundos - 1;

        // Chegou ao fim da fase: decide a próxima. Fase com duração 0 é
        // pulada (segurar = 0 em exercícios mais simples).
        setFase((faseAtual) => {
          if (faseAtual === "inspirar") {
            if (segurar > 0) {
              setRestante(segurar);
              return "segurar";
            }
            setRestante(expirar);
            return "expirar";
          }
          if (faseAtual === "segurar") {
            setRestante(expirar);
            return "expirar";
          }
          setCicloAtual((c) => c + 1);
          setRestante(inspirar);
          return "inspirar";
        });
        return 0;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [rodando, inspirar, segurar, expirar]);

  useEffect(() => {
    if (cicloAtual >= ciclos && !concluidoRef.current) {
      concluidoRef.current = true;
      setRodando(false);
      onConcluir();
    }
  }, [cicloAtual, ciclos, onConcluir]);

  const duracaoFase = fase === "inspirar" ? inspirar : fase === "segurar" ? segurar : expirar;
  // Círculo cheio ao inspirar, murcho ao expirar, parado ao segurar.
  const escala =
    fase === "inspirar" ? 1 : fase === "segurar" ? 1 : 0.55;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <div
          className="absolute rounded-full bg-brand-500/20"
          style={{
            width: "14rem",
            height: "14rem",
            transform: `scale(${rodando ? escala : 0.75})`,
            transition: `transform ${rodando ? duracaoFase : 0.4}s ease-in-out`,
          }}
        />
        <div
          className="absolute rounded-full bg-brand-500/40"
          style={{
            width: "9rem",
            height: "9rem",
            transform: `scale(${rodando ? escala : 0.75})`,
            transition: `transform ${rodando ? duracaoFase : 0.4}s ease-in-out`,
          }}
        />
        <div className="relative text-center">
          {rodando ? (
            <>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                {ROTULO[fase]}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-brand-600 dark:text-brand-300">
                {restante}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {cicloAtual >= ciclos ? "Terminou 🌿" : "Pronto para começar?"}
            </p>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        {Math.min(cicloAtual, ciclos)} de {ciclos} respirações
      </p>

      {!rodando && cicloAtual < ciclos && (
        <button
          type="button"
          onClick={() => setRodando(true)}
          className="mt-4 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
        >
          {cicloAtual === 0 ? "Começar a respirar" : "Continuar"}
        </button>
      )}
      {rodando && (
        <button
          type="button"
          onClick={() => setRodando(false)}
          className="mt-4 rounded-full border border-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Pausar
        </button>
      )}
    </div>
  );
}
