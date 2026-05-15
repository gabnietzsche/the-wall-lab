"use client";
import { motion } from "framer-motion";
import type { BrickContent } from "@/lib/types";
import PowerUpIcon from "./PowerUpIcon";

export type Outcome = "won" | "lost" | "opp_taken" | null;

interface Props {
  position: number;
  /** I miei hits sul mio lato (0..3). NON vedo i hits dell'avversario. */
  myHits: number;
  /** Il mio lato è rotto? */
  mySideBroken: boolean;
  /** Esito del mio lato rotto:
   *  - "won": l'ho preso io
   *  - "lost": collisione, perso
   *  - "opp_taken": l'avversario l'aveva preso prima
   *  - null: non ancora rotto
   */
  outcome: Outcome;
  /** Contenuto rivelato (visibile solo a lato rotto) */
  content?: BrickContent | null;
  /** Mattone "spiato" via raggi-x (mio lato intatto ma so dov'è qualcosa) */
  revealed: boolean;
  onTap: () => void;
  disabled: boolean;
}

export default function Brick({
  myHits,
  mySideBroken,
  outcome,
  content,
  revealed,
  onTap,
  disabled,
}: Props) {
  // --- Stato: mio lato rotto ---
  if (mySideBroken) {
    // Se l'avversario aveva già preso il contenuto, mostro solo un "muro bucato" anonimo:
    // niente icona, niente badge, niente moneta — l'utente non deve sapere cosa c'era.
    if (outcome === "opp_taken") {
      return (
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.12, 1], rotate: [0, -2, 2, 0] }}
          transition={{ duration: 0.4 }}
          className="aspect-square rounded-md border-[3px] border-brick-edge bg-brick-edge/60 halftone-bg relative overflow-hidden"
        />
      );
    }

    const showIcon = content && content !== "empty" && content !== "coin";
    const showCoin = content === "coin";
    const tone =
      outcome === "won"
        ? "bg-comic-green/30"
        : outcome === "lost"
        ? "bg-crack/30"
        : "bg-brick-edge/60";
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.18, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 0.45 }}
        className={`aspect-square rounded-md border-[3px] border-brick-edge ${tone} flex items-center justify-center halftone-bg relative overflow-hidden`}
      >
        {/* Contenuto rivelato — solo se l'ho preso io (won) o se è collisione (lost) */}
        {outcome === "won" && showCoin && (
          <span className="text-3xl sm:text-4xl comic-text-stroke text-coin">
            ¢
          </span>
        )}
        {outcome === "won" && showIcon && (
          <div className="drop-shadow-md">
            <PowerUpIcon type={content as BrickContent} size={32} />
          </div>
        )}
        {outcome === "won" && content === "empty" && (
          <span className="text-paper/40 text-xl">·</span>
        )}

        {/* Badge esito */}
        {outcome === "lost" && (
          <span className="absolute top-0.5 right-0.5 text-[10px] px-1 rounded bg-crack text-white comic-text-stroke">
            PERSO
          </span>
        )}
        {outcome === "won" && content === "coin" && (
          <span className="absolute top-0.5 left-0.5 text-[10px] px-1 rounded bg-comic-green text-white comic-text-stroke">
            +1
          </span>
        )}
      </motion.div>
    );
  }

  // --- Stato: mio lato intatto ---
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
      {/* Crepe progressive in base ai MIEI colpi */}
      {myHits >= 1 && (
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
          {myHits >= 2 && (
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
      {revealed && (
        <span className="absolute inset-0 flex items-center justify-center text-2xl text-comic-purple">
          ?
        </span>
      )}
    </button>
  );
}
