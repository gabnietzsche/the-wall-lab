"use client";
import { motion } from "framer-motion";
import PlayerSkin from "./PlayerSkin";

interface Props {
  myCoins: number;
  oppCoins: number;
  myNick: string;
  oppNick: string;
  mySkin?: string;
  oppSkin?: string;
  /** Lato del giocatore corrente: 1 = P1 (rosa), 2 = P2 (azzurro). */
  mySide: 1 | 2;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function GameOverModal({
  myCoins,
  oppCoins,
  myNick,
  oppNick,
  mySkin = "ladro",
  oppSkin = "ladro",
  mySide,
  onPlayAgain,
  onHome,
}: Props) {
  const win = myCoins > oppCoins;
  const draw = myCoins === oppCoins;

  const title = win ? "VITTORIA!" : draw ? "PAREGGIO" : "SCONFITTA";
  const titleColor = win ? "text-comic-green" : draw ? "text-coin" : "text-crack";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
    >
      <motion.div
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: -2, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="bg-paper comic-border rounded-2xl w-full max-w-sm p-6 text-center"
      >
        <h2 className={`text-6xl comic-text-stroke-lg ${titleColor}`}>{title}</h2>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <ScoreCol nick={myNick} coins={myCoins} skin={mySkin} playerSide={mySide} />
          <ScoreCol
            nick={oppNick}
            coins={oppCoins}
            skin={oppSkin}
            playerSide={mySide === 1 ? 2 : 1}
          />
        </div>

        <div className="mt-6 px-4 py-3 bg-coin/30 comic-border-thin rounded-xl">
          <div className="text-brick-edge text-lg">Hai guadagnato</div>
          <div className="text-4xl text-coin comic-text-stroke">+{myCoins} ¢</div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-4 text-3xl text-white bg-comic-pink comic-border rounded-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition"
          >
            RIGIOCA
          </button>
          <button
            onClick={onHome}
            className="w-full py-3 text-xl text-white bg-brick-edge comic-border-thin rounded-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition"
          >
            HOME
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ScoreCol({
  nick,
  coins,
  skin,
  playerSide,
}: {
  nick: string;
  coins: number;
  skin: string;
  /** P1 = sempre rosa, P2 = sempre azzurro */
  playerSide: 1 | 2;
}) {
  return (
    <div
      className={`px-2 py-2 rounded-xl comic-border-thin flex flex-col items-center gap-1 ${
        playerSide === 1 ? "bg-comic-pink" : "bg-sky"
      }`}
    >
      <div className="bg-paper/95 rounded-lg p-1 comic-border-thin">
        <PlayerSkin id={skin} size={44} />
      </div>
      <div className="text-white text-xs truncate comic-text-stroke w-full">{nick}</div>
      <div className="text-2xl text-white comic-text-stroke">¢{coins}</div>
    </div>
  );
}
