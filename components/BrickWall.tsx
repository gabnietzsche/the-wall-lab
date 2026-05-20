"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { BrickRow, BrickContent } from "@/lib/types";
import Brick, { type Outcome } from "./Brick";
import PlayerSkin from "./PlayerSkin";

interface Props {
  bricks: BrickRow[];
  mySide: 1 | 2;
  onTap: (position: number) => void;
  disabled: boolean;
  revealed: Map<number, BrickContent>;
  /** Skin dell'avversario, mostrata come sagoma in trasparenza dietro al muro. */
  opponentSkinId?: string | null;
}

function computeOutcome(
  mySideBroken: boolean,
  takenBy: number | null,
  mySide: 1 | 2
): Outcome {
  if (!mySideBroken) return null;
  if (takenBy === 0) return "lost";
  if (takenBy === mySide) return "won";
  return "opp_taken";
}

export default function BrickWall({
  bricks,
  mySide,
  onTap,
  disabled,
  revealed,
  opponentSkinId,
}: Props) {
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
      className="relative w-full max-w-md aspect-square p-3 rounded-2xl bg-brick-edge/30 comic-border halftone-bg overflow-hidden"
    >
      {/* Sagoma dell'avversario dietro al muro */}
      {opponentSkinId && (
        <motion.div
          aria-hidden
          animate={{ y: [0, -6, 0], opacity: [0.22, 0.34, 0.22] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 flex items-end justify-center pointer-events-none z-0"
          style={{ mixBlendMode: "multiply" }}
        >
          <PlayerSkin
            id={opponentSkinId}
            variant="silhouette"
            size={260}
            className="-mb-2"
          />
        </motion.div>
      )}

      {/* Griglia di mattoni — sopra la sagoma */}
      <div className="relative z-10 grid grid-cols-5 gap-2 w-full h-full">
        {Array.from({ length: 25 }).map((_, pos) => {
          const b = byPos.get(pos);
          const myHits = mySide === 1 ? b?.front_hits ?? 0 : b?.back_hits ?? 0;
          const mySideBroken =
            mySide === 1 ? !!b?.front_broken_at : !!b?.back_broken_at;
          const outcome = computeOutcome(mySideBroken, b?.taken_by ?? null, mySide);
          return (
            <Brick
              key={pos}
              position={pos}
              myHits={myHits}
              mySideBroken={mySideBroken}
              outcome={outcome}
              content={b?.revealed_content ?? undefined}
              revealed={revealed.has(pos)}
              onTap={() => !disabled && onTap(pos)}
              disabled={disabled || mySideBroken}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
