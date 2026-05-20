"use client";
import { motion } from "framer-motion";

interface Props {
  /** Secondi rimanenti del gioco effettivo (0..60). */
  secondsLeft: number;
  /** True durante l'overtime → effetto al massimo. */
  inOvertime?: boolean;
}

/**
 * Vignetta rossa pulsante che diventa più intensa negli ultimi 20s.
 * Pure visual: niente audio qui (la logica suoni vive in GameClient).
 *
 * Fasi:
 *  > 20s   → invisibile (return null)
 *  20-11s  → vignetta leggera, pulse 1.2s
 *  10-6s   → vignetta media, pulse 0.8s
 *  ≤5s     → vignetta intensa, pulse 0.4s
 *  overtime → intensa al massimo + pulse 0.5s costante
 */
export default function SpicyOverlay({ secondsLeft, inOvertime = false }: Props) {
  if (!inOvertime && secondsLeft > 20) return null;

  const tier: 1 | 2 | 3 = inOvertime
    ? 3
    : secondsLeft <= 5
    ? 3
    : secondsLeft <= 10
    ? 2
    : 1;

  const opacityRange =
    tier === 3 ? [0.35, 0.6] : tier === 2 ? [0.2, 0.4] : [0.1, 0.22];
  const duration = tier === 3 ? 0.5 : tier === 2 ? 0.8 : 1.2;

  return (
    <motion.div
      aria-hidden
      animate={{ opacity: opacityRange }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        background:
          "radial-gradient(ellipse at center, transparent 30%, rgba(230,57,70,0.85) 100%)",
        mixBlendMode: "multiply",
      }}
    />
  );
}
