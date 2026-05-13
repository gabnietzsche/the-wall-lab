"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { BrickRow, BrickContent } from "@/lib/types";
import Brick from "./Brick";

interface Props {
  bricks: BrickRow[];
  mySide: 1 | 2;
  onTap: (position: number) => void;
  disabled: boolean;
  revealed: Map<number, BrickContent>;
}

export default function BrickWall({ bricks, mySide, onTap, disabled, revealed }: Props) {
  // Riordina in mappa per accesso veloce
  const byPos = useMemo(() => {
    const m = new Map<number, BrickRow>();
    for (const b of bricks) m.set(b.position, b);
    return m;
  }, [bricks]);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: "backOut" }}
      className="grid grid-cols-5 gap-2 w-full max-w-md aspect-square p-3 rounded-2xl bg-brick-edge/30 comic-border halftone-bg"
    >
      {Array.from({ length: 25 }).map((_, pos) => {
        const b = byPos.get(pos);
        const myHits = mySide === 1 ? b?.front_hits ?? 0 : b?.back_hits ?? 0;
        const oppHits = mySide === 1 ? b?.back_hits ?? 0 : b?.front_hits ?? 0;
        return (
          <Brick
            key={pos}
            position={pos}
            myHits={myHits}
            oppHits={oppHits}
            broken={b?.broken ?? false}
            takenByMe={b?.taken_by === mySide}
            content={b?.revealed_content as BrickContent | undefined}
            revealed={revealed.has(pos)}
            onTap={() => !disabled && onTap(pos)}
            disabled={disabled}
          />
        );
      })}
    </motion.div>
  );
}
