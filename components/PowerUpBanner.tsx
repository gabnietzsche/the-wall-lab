"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  BrickContent,
  POWERUP_LABELS,
  POWERUP_DESCRIPTIONS,
  BONUS,
} from "@/lib/types";
import PowerUpIcon from "./PowerUpIcon";

export type BannerKind = "found" | "lost" | "opp_taken";

interface Props {
  kind: BannerKind;
  /** Contenuto effettivo del mattone (rilevante per "found", opzionale per gli altri). */
  content?: BrickContent;
  onDone: () => void;
}

export default function PowerUpBanner({ kind, content, onDone }: Props) {
  // Stabilizzo onDone in una ref così il setTimeout parte una sola volta al mount
  // (il parent re-rendera ogni 250ms a causa del timer di gioco).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Durata del banner — più breve per stati informativi, un attimo in più per i bonus/malus rivelati
  const duration = kind === "opp_taken" ? 800 : kind === "lost" ? 1100 : 1200;

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (kind === "opp_taken") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className="fixed top-28 left-1/2 -translate-x-1/2 pointer-events-none z-40"
      >
        <div className="px-4 py-2 rounded-xl bg-brick-edge text-white comic-border-thin">
          <div className="text-sm comic-text-stroke">
            Preso dall&apos;avversario
          </div>
        </div>
      </motion.div>
    );
  }

  if (kind === "lost") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.6, y: -10 }}
        transition={{ type: "spring", stiffness: 360, damping: 18 }}
        className="fixed top-24 left-1/2 -translate-x-1/2 pointer-events-none z-40"
      >
        <div className="px-6 py-3 rounded-2xl bg-crack comic-border text-center halftone-bg">
          <div className="text-xs uppercase tracking-widest text-white/90 comic-text-stroke">
            Collisione!
          </div>
          <div className="text-2xl text-white comic-text-stroke-lg mt-1">
            Premio perso
          </div>
          {content && content !== "empty" && content !== "coin" && (
            <div className="text-xs text-white/80 mt-1 comic-text-stroke">
              C&apos;era: {POWERUP_LABELS[content]}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // kind === "found"
  if (!content) return null;
  const isBonus = BONUS.includes(content);
  const label = POWERUP_LABELS[content];
  const desc = POWERUP_DESCRIPTIONS[content];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: -30, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: -2 }}
      exit={{ opacity: 0, scale: 0.7, y: -40 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 pointer-events-none z-40 w-[88vw] max-w-md"
    >
      <div
        className={`px-5 py-4 rounded-2xl comic-border halftone-bg text-center ${
          isBonus ? "bg-comic-green" : "bg-crack"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-white/90 comic-text-stroke">
          {isBonus ? "Bonus per te" : "Malus per te"}
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="bg-paper/95 rounded-xl p-2 comic-border-thin">
            <PowerUpIcon type={content} size={56} />
          </div>
          <div className="text-3xl sm:text-4xl text-white comic-text-stroke-lg leading-none text-left">
            {label}
          </div>
        </div>
        {desc && (
          <div className="mt-2 text-white text-sm sm:text-base comic-text-stroke">
            {desc}
          </div>
        )}
      </div>
    </motion.div>
  );
}
