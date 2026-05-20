"use client";
import { useEffect, useMemo } from "react";
import { motion, useAnimationControls } from "framer-motion";
import type { BrickRow, BrickContent } from "@/lib/types";
import Brick from "./Brick";

interface Props {
  bricks: BrickRow[];
  mySide: 1 | 2;
  onTap: (position: number) => void;
  disabled: boolean;
  revealed: Map<number, BrickContent>;
  /**
   * Timestamp del battito cardiaco corrente. Cambia → il muro pulsa per dare
   * la sensazione che "tutto pulsi a tempo" col battito (negli ultimi 10s).
   */
  pulseTrigger?: number | null;
}

export default function BrickWall({
  bricks,
  mySide,
  onTap,
  disabled,
  revealed,
  pulseTrigger,
}: Props) {
  const byPos = useMemo(() => {
    const m = new Map<number, BrickRow>();
    for (const b of bricks) m.set(b.position, b);
    return m;
  }, [bricks]);

  // Pulse sincrono col battito
  const controls = useAnimationControls();
  useEffect(() => {
    controls.start({
      scale: 1,
      opacity: 1,
      transition: { duration: 0.4, ease: "backOut" },
    });
  }, [controls]);
  useEffect(() => {
    if (pulseTrigger == null) return;
    controls.start({
      scale: [1, 1.025, 1],
      transition: { duration: 0.18, ease: "easeOut", times: [0, 0.35, 1] },
    });
  }, [pulseTrigger, controls]);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={controls}
      className="relative w-full max-w-md aspect-square p-3 rounded-2xl bg-brick-edge/30 comic-border halftone-bg overflow-hidden"
    >
      <div className="relative z-10 grid grid-cols-5 gap-2 w-full h-full">
        {Array.from({ length: 25 }).map((_, pos) => {
          const b = byPos.get(pos);
          const totalHits = (b?.front_hits ?? 0) + (b?.back_hits ?? 0);
          const hitsNeeded = b?.hits_needed ?? 2;
          const broken = !!b?.broken;
          return (
            <Brick
              key={pos}
              position={pos}
              totalHits={totalHits}
              hitsNeeded={hitsNeeded}
              broken={broken}
              mySide={mySide}
              takenBy={b?.taken_by ?? null}
              content={b?.revealed_content ?? undefined}
              revealed={revealed.has(pos)}
              onTap={() => !disabled && onTap(pos)}
              disabled={disabled || broken}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
