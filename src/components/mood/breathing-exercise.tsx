"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wind } from "lucide-react";

type Phase = "inspire" | "segure" | "expire";

const PHASE_DURATION_MS = 4000;
const PHASE_LABEL: Record<Phase, string> = {
  inspire: "Inspire...",
  segure: "Segure...",
  expire: "Expire...",
};
const PHASE_SCALE: Record<Phase, number> = {
  inspire: 1.5,
  segure: 1.5,
  expire: 0.85,
};
const NEXT_PHASE: Record<Phase, Phase> = {
  inspire: "segure",
  segure: "expire",
  expire: "inspire",
};
const SESSION_SECONDS = 90;

// Timer visual de respiração guiada (sem áudio nesta fase) — ciclo simples
// de inspire/segure/expire de 4s cada, por ~1min30.
export function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("inspire");
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);

  useEffect(() => {
    if (!running) return;
    const phaseTimer = setInterval(() => {
      setPhase((p) => NEXT_PHASE[p]);
    }, PHASE_DURATION_MS);
    const countdownTimer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      clearInterval(phaseTimer);
      clearInterval(countdownTimer);
    };
  }, [running]);

  function handleStart() {
    setPhase("inspire");
    setSecondsLeft(SESSION_SECONDS);
    setRunning(true);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-28 w-28 items-center justify-center">
        <motion.div
          animate={{ scale: running ? PHASE_SCALE[phase] : 1 }}
          transition={{ duration: PHASE_DURATION_MS / 1000, ease: "easeInOut" }}
          className="h-16 w-16 rounded-full bg-brand-500"
        />
      </div>

      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {running ? PHASE_LABEL[phase] : "Exercício de respiração guiada"}
      </p>

      {running ? (
        <>
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            {secondsLeft}s restantes
          </p>
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
          >
            Encerrar
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Wind className="h-4 w-4" />
          Começar (1min30)
        </button>
      )}
    </div>
  );
}
