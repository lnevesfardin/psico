"use client";

import { Fragment, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useWeightHover } from "@/components/motion/use-weight-hover";

const container: Variants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
};

const word: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] },
  },
};

/**
 * Título que se forma como fumaça: cada palavra sai de um desfoque até
 * assentar. Terminada a entrada, as letras passam a reagir à proximidade
 * do cursor (ver useWeightHover).
 *
 * Renderiza um <span> — quem chama mantém o <h1>/<h2> e as classes, para
 * não perder a semântica do documento. O texto real vai num sr-only e a
 * camada animada é aria-hidden: leitores de tela leem a frase inteira, em
 * vez de soletrarem as letras dos spans.
 */
export function SmokyText({
  text,
  delay = 0,
  stagger = 0.08,
  interactive = true,
}: {
  text: string;
  delay?: number;
  stagger?: number;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [revealed, setRevealed] = useState(false);
  const prefersReduced = useReducedMotion();

  useWeightHover(ref, { enabled: interactive && revealed });

  const words = text.split(" ");

  if (prefersReduced) {
    return <span ref={ref}>{text}</span>;
  }

  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden="true"
        initial="hidden"
        animate="visible"
        custom={stagger}
        variants={container}
        transition={{ delayChildren: delay }}
        onAnimationComplete={() => setRevealed(true)}
      >
        {words.map((item, wordIndex) => (
          <Fragment key={`${item}-${wordIndex}`}>
            <motion.span variants={word} className="inline-block">
              {Array.from(item).map((char, charIndex) => (
                <span key={charIndex} data-weight-char>
                  {char}
                </span>
              ))}
            </motion.span>
            {wordIndex < words.length - 1 && " "}
          </Fragment>
        ))}
      </motion.span>
    </span>
  );
}
