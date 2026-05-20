"use client";

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
}: Props) {
  const cooldownPct = Math.min(100, Math.max(0, (cooldownLeft / 1000) * 100));
  const timeLow = secondsLeft <= 10;

  return (
    <header className="px-3 pt-3 pb-2 flex flex-col gap-2">
      {/* Riga punteggi */}
      <div className="flex items-stretch gap-2">
        <ScoreBadge nick={myNick} coins={myCoins} mine hidden={!oppCanSeeMyScore} />
        <div className="flex flex-col items-center justify-center px-2">
          <div
            className={`text-5xl comic-text-stroke ${
              timeLow ? "text-crack animate-shake" : "text-white"
            }`}
          >
            {secondsLeft}
          </div>
          <div className="text-xs text-white/80 comic-text-stroke">sec</div>
        </div>
        <ScoreBadge
          nick={oppNick}
          coins={oppCoins}
          mine={false}
          hidden={!showOppScore}
        />
      </div>

      {/* Riga colpi rimanenti + cooldown */}
      <div className="flex items-center gap-3 px-1">
        <div className="text-paper text-xl comic-text-stroke">
          ⚒ {myShotsLeft}
        </div>
        <div className="flex-1 h-3 rounded-full bg-brick-edge/40 comic-border-thin overflow-hidden">
          <div
            className="h-full bg-comic-green transition-all"
            style={{ width: `${100 - cooldownPct}%` }}
          />
        </div>
      </div>
    </header>
  );
}

function ScoreBadge({
  nick,
  coins,
  mine,
  hidden,
}: {
  nick: string;
  coins: number;
  mine: boolean;
  hidden: boolean;
}) {
  return (
    <div
      className={`flex-1 px-3 py-2 rounded-xl comic-border ${
        mine ? "bg-comic-pink" : "bg-sky"
      }`}
    >
      <div className="text-white text-sm truncate comic-text-stroke">{nick}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl text-coin comic-text-stroke">¢</span>
        <span className="text-3xl text-white comic-text-stroke">
          {hidden ? "??" : coins}
        </span>
      </div>
    </div>
  );
}

