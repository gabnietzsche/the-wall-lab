"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getClientId,
  getNick,
  getSkin,
  getSupabase,
} from "@/lib/supabase";
import PowerupLegend from "@/components/PowerupLegend";

export default function LobbyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Cerco un avversario...");
  const [waitSec, setWaitSec] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    const nick = getNick();
    if (!nick) {
      router.replace("/");
      return;
    }
    const clientId = getClientId();
    const supabase = getSupabase();
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let secTimer: ReturnType<typeof setInterval> | null = null;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const skin = getSkin();
    async function tryMatch() {
      if (cancelled.current) return;
      const { data, error } = await supabase.rpc("request_match", {
        p_client_id: clientId,
        p_nick: nick,
        p_skin: skin,
      });
      if (error) {
        setStatus("Errore di connessione. Riprovo...");
        return;
      }
      const gameId =
        Array.isArray(data) && data[0] ? data[0].game_id : (data?.game_id ?? null);
      if (gameId) {
        if (pollTimer) clearInterval(pollTimer);
        if (secTimer) clearInterval(secTimer);
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        router.replace(`/game/${gameId}`);
      }
    }

    // Listener realtime: se qualcun altro mi accoppia, vedo apparire una games
    realtimeChannel = supabase
      .channel("lobby-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "games" },
        (payload) => {
          const g = payload.new as { id: string; player1_id: string; player2_id: string };
          if (g.player1_id === clientId || g.player2_id === clientId) {
            cancelled.current = true;
            if (pollTimer) clearInterval(pollTimer);
            if (secTimer) clearInterval(secTimer);
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
            router.replace(`/game/${g.id}`);
          }
        }
      )
      .subscribe();

    // Primo tentativo subito, poi ogni 2s per 30s
    tryMatch();
    pollTimer = setInterval(tryMatch, 2500);
    secTimer = setInterval(() => setWaitSec((s) => s + 1), 1000);

    return () => {
      cancelled.current = true;
      if (pollTimer) clearInterval(pollTimer);
      if (secTimer) clearInterval(secTimer);
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      // Pulisco la lobby (best-effort)
      supabase.rpc("cancel_match", { p_client_id: clientId });
    };
  }, [router]);

  useEffect(() => {
    if (waitSec >= 30) {
      setStatus("Nessun avversario trovato. Riprova tra poco!");
    }
  }, [waitSec]);

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 sm:px-6 py-6 gap-5">
      <div className="grid grid-cols-3 grid-rows-3 gap-2 animate-pop">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="w-14 h-10 sm:w-16 sm:h-12 rounded-md border-[3px] border-brick-edge bg-brick"
            style={{
              boxShadow: "inset -3px -3px 0 0 #C99A1F, 3px 3px 0 0 #3A2410",
              animation: `pop 0.5s ${i * 0.08}s both`,
            }}
          />
        ))}
      </div>

      <div className="text-center">
        <p className="text-3xl sm:text-4xl text-white comic-text-stroke leading-tight">
          {status}
        </p>
        {waitSec < 30 && (
          <p className="mt-2 text-lg sm:text-xl text-paper/90 comic-text-stroke">
            {Math.max(0, 30 - waitSec)}s
          </p>
        )}
      </div>

      <button
        onClick={() => router.replace("/")}
        className="px-6 py-3 text-2xl text-white bg-brick-edge comic-border-thin rounded-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition"
      >
        ANNULLA
      </button>

      {/* Legenda — utile da leggere mentre aspetti l'avversario */}
      <section className="w-full max-w-md bg-paper rounded-2xl comic-border p-4 mt-2">
        <h2 className="text-xl sm:text-2xl text-brick-edge mb-3 text-center font-bold">
          Cosa c&apos;è dietro i mattoni
        </h2>
        <PowerupLegend compact />
      </section>
    </main>
  );
}
