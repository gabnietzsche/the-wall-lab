"use client";
import { motion, AnimatePresence } from "framer-motion";
import PlayerSkin from "./PlayerSkin";

interface Props {
  secondsLeft: number;
  myNick: string;
  oppNick: string;
  myCoins: number;
  oppCoins: number;
  myShotsLeft: number;
  cooldownLeft: number;
  showOppScore: boolean;
  oppCanSeeMyScore: boolean;
  mySkin?: string | null;
  oppSkin?: string | null;
  /** Lato del giocatore corrente: 1 = P1 (rosa), 2 = P2 (azzurro). */
  mySide: 1 | 2;
  streak: number;
  inOvertime?: boolean;
}

export default function Hud({
  secondsLeft,
  myNick,
  oppNick,
  myCoins,
  oppCoins,
  myShotsLeft,
  cooldownLeft,
  showOppScore,
  oppCanSeeMyScore,
  mySkin = "ladro",
  oppSkin = "ladro",
  mySide,
  streak,
  inOvertime = false,
}: Props) {
  const cooldownPct = Math.min(100, Math.max(0, (cooldownLeft / 1000) * 100));
  // Colore timer
  const phase: "normal" | "warn" | "danger" = inOvertime
    ? "danger"
    : secondsLeft <= 10
    ? "danger"
    : secondsLeft <= 20
    ? "warn"
    : "normal";

  const timerClass =
    phase === "danger"
      ? "text-crack animate-shake"
      : phase === "warn"
      ? "text-comic-orange animate-shake"
      : "text-white";

  const timerSize =
    phase === "danger" ? "text-7xl" : phase === "warn" ? "text-6xl" : "text-5xl";

  return (
    <header className="px-3 pt-3 pb-2 flex flex-col gap-2">
      {/* Riga punteggi */}
      <div className="flex items-stretch gap-2">
        <ScoreBadge
          nick={myNick}
          coins={myCoins}
          playerSide={mySide}
          hidden={!oppCanSeeMyScore}
          skin={mySkin ?? "ladro"}
        />
        <div className="flex flex-col items-center justify-center px-1">
          <div className={`${timerSize} ${timerClass} comic-text-stroke leading-none`}>
            {secondsLeft}
          </div>
          <div className="text-[10px] text-white/80 comic-text-stroke uppercase tracking-wider">
            {inOvertime ? "Overtime" : "sec"}
          </div>
        </div>
        <ScoreBadge
          nick={oppNick}
          coins={oppCoins}
          playerSide={mySide === 1 ? 2 : 1}
          hidden={!showOppScore}
          skin={oppSkin ?? "ladro"}
        />
      </div>

      {/* Riga colpi rimanenti + cooldown + streak */}
      <div className="flex items-center gap-3 px-1">
        <div className="text-paper text-xl comic-text-stroke">⚒ {myShotsLeft}</div>
        <div className="flex-1 h-3 rounded-full bg-brick-edge/40 comic-border-thin overflow-hidden">
          <div
            className="h-full bg-comic-green transition-all"
            style={{ width: `${100 - cooldownPct}%` }}
          />
        </div>
        <AnimatePresence>
          {streak > 0 && (
            <motion.div
              key={`streak-${streak}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className={`px-2 py-0.5 rounded-md comic-border-thin text-sm font-bold comic-text-stroke ${
                streak >= 2 ? "bg-comic-orange text-white" : "bg-coin text-brick-edge"
              }`}
              aria-label="Streak in corso"
            >
              <span className="mr-1">+</span>
              {streak}/3
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function ScoreBadge({
  nick,
  coins,
  playerSide,
  hidden,
  skin,
}: {
  nick: string;
  coins: number;
  /** P1 = sempre rosa, P2 = sempre azzurro (uguale su entrambi gli schermi). */
  playerSide: 1 | 2;
  hidden: boolean;
  skin: string;
}) {
  return (
    <div
      className={`flex-1 px-2 py-1.5 rounded-xl comic-border flex items-center gap-2 ${
        playerSide === 1 ? "bg-comic-pink" : "bg-sky"
      }`}
    >
      <div className="shrink-0 bg-paper/95 rounded-lg p-0.5 comic-border-thin">
        <PlayerSkin id={skin} size={34} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white text-xs truncate comic-text-stroke">{nick}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl text-coin comic-text-stroke">¢</span>
          <span className="text-2xl text-white comic-text-stroke">
            {hidden ? "??" : coins}
          </span>
        </div>
      </div>
    </div>
  );
}
