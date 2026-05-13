"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BrickContent, POWERUP_LABELS, POWERUP_DESCRIPTIONS, BONUS } from "@/lib/types";

interface Props {
  type: BrickContent;
  onDone: () => void;
}

export default function PowerUpBanner({ type, onDone }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 1000);
    return () => clearTimeout(t);
  }, []);

  const isBonus = BONUS.includes(type);
  const label = POWERUP_LABELS[type];
  const desc = POWERUP_DESCRIPTIONS[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, rotate: -4 }}
      exit={{ opacity: 0, scale: 0.6, y: -40 }}
      transition={{ type: "spring", stiffness: 360, damping: 16 }}
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-40"
    >
      <div
        className={`px-6 py-4 rounded-2xl comic-border halftone-bg text-center max-w-[80vw] ${
          isBonus ? "bg-comic-green" : "bg-crack"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-white/90 comic-text-stroke mb-1">
          {isBonus ? "Bonus" : "Malus"}
        </div>
        <div className="text-4xl text-white comic-text-stroke-lg">{label}</div>
        {desc && (
          <div className="mt-1 text-white text-sm comic-text-stroke">{desc}</div>
        )}
      </div>
    </motion.div>
  );
}
