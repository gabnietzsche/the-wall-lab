"use client";
import { motion } from "framer-motion";
import type { BrickContent } from "@/lib/types";

interface Props {
  position: number;
  myHits: number;
  oppHits: number;
  broken: boolean;
  takenByMe: boolean;
  content?: BrickContent;
  revealed: boolean;
  onTap: () => void;
  disabled: boolean;
}

const ICON: Record<BrickContent, string> = {
  coin: "¢",
  empty: "·",
  pistola: "▶",
  dinamite: "✸",
  "raggi-x": "☢",
  scudo: "◈",
  quadrifoglio: "✿",
  scalpello: "⚒",
  gabbia: "▦",
  "doppia-gabbia": "▩",
  fantasma: "☂",
};

const COLOR: Record<BrickContent, string> = {
  coin: "text-coin",
  empty: "text-brick-edge/40",
  pistola: "text-comic-pink",
  dinamite: "text-crack",
  "raggi-x": "text-comic-purple",
  scudo: "text-sky",
  quadrifoglio: "text-comic-green",
  scalpello: "text-brick-edge",
  gabbia: "text-brick-edge",
  "doppia-gabbia": "text-crack",
  fantasma: "text-comic-purple",
};

export default function Brick({
  myHits,
  oppHits,
  broken,
  takenByMe,
  content,
  revealed,
  onTap,
  disabled,
}: Props) {
  const totalHits = myHits + oppHits;

  if (broken) {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.15, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 0.45 }}
        className="aspect-square rounded-md border-[3px] border-brick-edge bg-brick-edge/80 flex items-center justify-center halftone-bg relative"
      >
        {content && content !== "empty" && (
          <span
            className={`text-2xl sm:text-3xl ${COLOR[content]} ${
              takenByMe ? "comic-text-stroke" : "opacity-40"
            }`}
          >
            {ICON[content]}
          </span>
        )}
        {content === "empty" && (
          <span className="text-2xl text-paper/30">·</span>
        )}
      </motion.div>
    );
  }

  return (
    <button
      onClick={onTap}
      disabled={disabled}
      className={`relative aspect-square rounded-md border-[3px] border-brick-edge transition-transform active:scale-95 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${revealed ? "bg-comic-purple/40" : "bg-brick"}`}
      style={{
        boxShadow: "inset -3px -3px 0 0 #C99A1F, 2px 2px 0 0 #3A2410",
      }}
      aria-label={`Mattone`}
    >
      {/* Crepe — proporzionate al totale di colpi */}
      {totalHits >= 1 && !broken && (
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <path
            d="M 20 4 L 18 14 L 24 20 L 16 26 L 22 36"
            stroke="#3A2410"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          {totalHits >= 2 && (
            <path
              d="M 6 18 L 14 20 L 20 16 M 26 22 L 34 18"
              stroke="#E63946"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}
      {/* Indicatore "anche l'altro ha colpito" — piccolo puntino */}
      {oppHits > 0 && !broken && (
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-crack" />
      )}
      {revealed && (
        <span className="absolute inset-0 flex items-center justify-center text-2xl text-comic-purple">
          ?
        </span>
      )}
    </button>
  );
}
