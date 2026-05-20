"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNick,
  setNick,
  getTotalCoins,
  getClientId,
  getSkin,
  setSkin,
} from "@/lib/supabase";
import { unlockAudio } from "@/lib/audio";
import PlayerSkin, { PLAYER_SKINS } from "@/components/PlayerSkin";

export default function Home() {
  const router = useRouter();
  const [nick, setNickState] = useState("");
  const [coins, setCoins] = useState(0);
  const [skin, setSkinState] = useState<string>("ladro");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNickState(getNick());
    setCoins(getTotalCoins());
    setSkinState(getSkin());
    getClientId();
    setMounted(true);
  }, []);

  function pickSkin(id: string) {
    setSkinState(id);
    setSkin(id);
  }

  function startGame() {
    unlockAudio();
    const clean = nick.trim().slice(0, 16);
    if (!clean) return;
    setNick(clean);
    setSkin(skin);
    router.push("/lobby");
  }

  if (!mounted) return null;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-between px-6 pt-8 pb-6">
      <header className="w-full max-w-md text-center">
        <h1
          className="text-6xl text-coin comic-text-stroke-lg leading-none tracking-wider"
          style={{ textShadow: "0 6px 0 #3A2410" }}
        >
          THE WALL
        </h1>
        <p className="mt-2 text-lg text-white comic-text-stroke">
          1v1 realtime. Ogni colpo conta.
        </p>
      </header>

      <section className="w-full max-w-md flex flex-col items-center gap-4">
        <div className="w-full">
          <label className="block text-white text-2xl comic-text-stroke mb-2">
            Il tuo nickname
          </label>
          <input
            value={nick}
            onChange={(e) => setNickState(e.target.value.slice(0, 16))}
            placeholder="es. SmashKing"
            className="w-full px-4 py-4 text-2xl font-display tracking-wider bg-paper text-brick-edge comic-border rounded-xl outline-none placeholder:text-brick-edge/40"
            maxLength={16}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Selezione skin */}
        <div className="w-full">
          <label className="block text-white text-xl comic-text-stroke mb-2">
            La tua faccia
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PLAYER_SKINS.map((s) => {
              const selected = s.id === skin;
              return (
                <button
                  key={s.id}
                  onClick={() => pickSkin(s.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl transition active:translate-y-0.5 ${
                    selected
                      ? "bg-comic-green comic-border"
                      : "bg-paper/90 comic-border-thin"
                  }`}
                >
                  <PlayerSkin id={s.id} size={56} />
                  <span
                    className={`text-xs ${
                      selected ? "text-white comic-text-stroke" : "text-brick-edge"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={startGame}
          disabled={!nick.trim()}
          className="w-full py-4 text-3xl text-white bg-comic-pink comic-border rounded-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          GIOCA
        </button>

        <div className="w-full bg-paper/90 comic-border-thin rounded-xl px-4 py-2 text-center">
          <span className="text-brick-edge text-lg">Monete totali </span>
          <span className="text-xl text-coin comic-text-stroke">¢{coins}</span>
        </div>
      </section>

      <footer className="text-white/80 text-sm comic-text-stroke">beta v0.2</footer>
    </main>
  );
}
