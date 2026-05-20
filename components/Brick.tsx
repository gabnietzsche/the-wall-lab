"use client";
import { motion } from "framer-motion";
import type { BrickContent } from "@/lib/types";
import PowerUpIcon from "./PowerUpIcon";

interface Props {
  position: number;
  /** Colpi totali ricevuti dal mattone (front + back). Vista condivisa. */
  totalHits: number;
  /** Soglia di rottura (random 2 o 3 alla creazione). */
  hitsNeeded: number;
  /** true se il mattone è rotto */
  broken: boolean;
  /** Lato del giocatore corrente, per sapere se sono "io" il vincitore */
  mySide: 1 | 2;
  /** 1 = P1, 2 = P2, null = nessuno ancora */
  takenBy: number | null;
  /** Contenuto rivelato (visibile solo a mattone rotto) */
  content?: BrickContent | null;
  /** Mattone "spiato" via raggi-x (intatto ma so dov'è qualcosa) */
  revealed: boolean;
  onTap: () => void;
  disabled: boolean;
}

export default function Brick({
  totalHits,
  hitsNeeded,
  broken,
  mySide,
  takenBy,
  content,
  revealed,
  onTap,
  disabled,
}: Props) {
  // --- Stato: mattone rotto ---
  if (broken) {
    const wonByMe = takenBy === mySide;
    const showIcon = content && content !== "empty" && content !== "coin";
    const showCoin = content === "coin";

    // Colore del mattone rotto = colore del giocatore che ha rotto
    // P1 = comic-pink (rosa), P2 = sky (azzurro)
    const tone =
      takenBy === 1
        ? "bg-comic-pink/55 border-comic-pink"
        : takenBy === 2
        ? "bg-sky/55 border-sky"
        : "bg-brick-edge/40 border-brick-edge/50";

    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.18, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 0.45 }}
        className={`aspect-square rounded-md border-[3px] ${tone} flex items-center justify-center halftone-bg relative overflow-hidden`}
      >
        {showCoin && (
          <span className="text-3xl sm:text-4xl comic-text-stroke text-coin">¢</span>
        )}
        {showIcon && (
          <div className={wonByMe ? "drop-shadow-md" : ""}>
            <PowerUpIcon type={content as BrickContent} size={32} />
          </div>
        )}
        {content === "empty" && (
          <span className="text-paper/40 text-xl">·</span>
        )}

        {/* Badge "+1 ¢" se chi ha rotto era me e ha preso moneta */}
        {wonByMe && content === "coin" && (
          <span className="absolute top-0.5 left-0.5 text-[10px] px-1 rounded bg-comic-green text-white comic-text-stroke">
            +1
          </span>
        )}
      </motion.div>
    );
  }

  // --- Stato: mattone intatto ---
  // Le crepe ora rappresentano i colpi totali, visibili a entrambi
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
      aria-label="Mattone"
    >
      {/* Crepe progressive in base ai colpi totali (vista condivisa).
          Step 1: zigzag verticale.
          Step 2: raggiera nera (8 linee che si irradiano dal centro).
          Step 3: raggiera più densa con linee diagonali addizionali. */}
      {totalHits >= 1 && (
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* Crepa primaria (zigzag) */}
          <path
            d="M 20 4 L 18 14 L 24 20 L 16 26 L 22 36"
            stroke="#3A2410"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Raggiera step 2 — 8 linee dal centro verso fuori */}
          {totalHits >= 2 && (
            <g
              stroke="#3A2410"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            >
              <line x1="20" y1="20" x2="4"  y2="4" />
              <line x1="20" y1="20" x2="36" y2="4" />
              <line x1="20" y1="20" x2="4"  y2="36" />
              <line x1="20" y1="20" x2="36" y2="36" />
              <line x1="20" y1="20" x2="2"  y2="20" strokeWidth="1.6" />
              <line x1="20" y1="20" x2="38" y2="20" strokeWidth="1.6" />
              <line x1="20" y1="20" x2="20" y2="2"  strokeWidth="1.6" />
              <line x1="20" y1="20" x2="20" y2="38" strokeWidth="1.6" />
            </g>
          )}

          {/* Step 3 — raggiera secondaria più sottile per riempire i gap */}
          {totalHits >= 3 && (
            <g
              stroke="#3A2410"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            >
              <line x1="20" y1="20" x2="10" y2="2" />
              <line x1="20" y1="20" x2="30" y2="2" />
              <line x1="20" y1="20" x2="2"  y2="10" />
              <line x1="20" y1="20" x2="38" y2="10" />
              <line x1="20" y1="20" x2="2"  y2="30" />
              <line x1="20" y1="20" x2="38" y2="30" />
              <line x1="20" y1="20" x2="10" y2="38" />
              <line x1="20" y1="20" x2="30" y2="38" />
            </g>
          )}
        </svg>
      )}

      {revealed && (
        <span className="absolute inset-0 flex items-center justify-center text-2xl text-comic-purple">
          ?
        </span>
      )}
    </button>
  );
}
