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
      {/* Crepe progressive in base ai colpi totali (vista condivisa) */}
      {totalHits >= 1 && (
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
          {totalHits >= 3 && (
            <path
              d="M 4 8 L 16 12 M 28 30 L 36 34 M 8 34 L 14 28"
              stroke="#3A2410"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}

      {/* Indicatore della soglia per i mattoni "duri" (3 colpi) */}
      {hitsNeeded === 3 && totalHits === 0 && (
        <span className="absolute top-0.5 right-0.5 text-[9px] px-1 rounded bg-brick-edge text-white comic-text-stroke opacity-70">
          3
        </span>
      )}

      {revealed && (
        <span className="absolute inset-0 flex items-center justify-center text-2xl text-comic-purple">
          ?
        </span>
      )}
    </button>
  );
}
