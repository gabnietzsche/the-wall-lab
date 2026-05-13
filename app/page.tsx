"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNick, setNick, getTotalCoins, getClientId } from "@/lib/supabase";
import { unlockAudio } from "@/lib/audio";

export default function Home() {
  const router = useRouter();
  const [nick, setNickState] = useState("");
  const [coins, setCoins] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNickState(getNick());
    setCoins(getTotalCoins());
    getClientId(); // assicura che esista
    setMounted(true);
  }, []);

  function startGame() {
    unlockAudio();
    const clean = nick.trim().slice(0, 16);
    if (!clean) return;
    setNick(clean);
    router.push("/lobby");
  }

  if (!mounted) return null;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-between px-6 pt-10 pb-8">
      <header className="w-full max-w-md text-center">
        <h1
          className="text-7xl text-coin comic-text-stroke-lg leading-none tracking-wider"
          style={{ textShadow: "0 6px 0 #3A2410" }}
        >
          THE WALL
        </h1>
        <p className="mt-3 text-xl text-white comic-text-stroke">
          1v1 realtime. Ogni colpo conta.
        </p>
      </header>

      <section className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Logo: muro stilizzato */}
        <div className="relative w-48 h-48 mx-auto">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 rotate-[-3deg]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border-[3px] border-brick-edge bg-brick"
                style={{
                  boxShadow: "inset -3px -3px 0 0 #C99A1F, 3px 3px 0 0 #3A2410",
                }}
              />
            ))}
          </div>
          <div
            className="absolute -top-2 -right-2 w-14 h-14 rounded-full bg-coin border-[4px] border-brick-edge flex items-center justify-center text-3xl text-brick-edge animate-wobble"
            style={{ boxShadow: "3px 3px 0 0 #3A2410" }}
          >
            ¢
          </div>
        </div>

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

        <button
          onClick={startGame}
          disabled={!nick.trim()}
          className="w-full py-5 text-4xl text-white bg-comic-pink comic-border rounded-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          GIOCA
        </button>

        <div className="w-full bg-paper/90 comic-border-thin rounded-xl px-4 py-3 text-center">
          <span className="text-brick-edge text-xl">Monete totali </span>
          <span className="text-2xl text-coin comic-text-stroke">¢{coins}</span>
        </div>
      </section>

      <footer className="text-white/80 text-sm comic-text-stroke">
        beta v0.1
      </footer>
    </main>
  );
}
