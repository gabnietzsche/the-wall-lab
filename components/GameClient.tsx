"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  getClientId,
  getSupabase,
  getNick,
  addCoins,
} from "@/lib/supabase";
import { play, unlockAudio } from "@/lib/audio";
import type {
  BrickRow,
  Game,
  PlayerState,
  ActiveEffect,
  BrickContent,
} from "@/lib/types";
import { BONUS } from "@/lib/types";
import BrickWall from "./BrickWall";
import Hud from "./Hud";
import PowerUpBanner, { type BannerKind } from "./PowerUpBanner";
import ActiveEffectsBar from "./ActiveEffectsBar";
import GameOverModal from "./GameOverModal";
import PowerupLegend from "./PowerupLegend";

interface Props {
  gameId: string;
}

export default function GameClient({ gameId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const clientId = useMemo(
    () => (typeof window !== "undefined" ? getClientId() : ""),
    []
  );
  const myNickRef = useRef<string>("");

  const [game, setGame] = useState<Game | null>(null);
  const [bricks, setBricks] = useState<BrickRow[]>([]);
  const [myState, setMyState] = useState<PlayerState | null>(null);
  const [oppState, setOppState] = useState<PlayerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [lastWonCoinAt, setLastWonCoinAt] = useState<{
    position: number;
    ts: number;
  } | null>(null);
  const [flash, setFlash] = useState<{
    kind: BannerKind;
    content?: BrickContent;
    id: number;
  } | null>(null);
  const [revealedPositions, setRevealedPositions] = useState<Map<number, BrickContent>>(
    new Map()
  );
  const [showLegend, setShowLegend] = useState(false);
  const finalizedRef = useRef(false);
  const coinsCreditedRef = useRef(false);
  const bricksRef = useRef<BrickRow[]>([]);
  const mySideRef = useRef<1 | 2 | null>(null);

  const mySide: 1 | 2 | null =
    game?.player1_id === clientId ? 1 : game?.player2_id === clientId ? 2 : null;
  const oppSide: 1 | 2 | null = mySide === 1 ? 2 : mySide === 2 ? 1 : null;
  void oppSide;

  // Tengo ref aggiornata
  useEffect(() => {
    bricksRef.current = bricks;
  }, [bricks]);
  useEffect(() => {
    mySideRef.current = mySide;
  }, [mySide]);

  // Carica stato iniziale + subscribe realtime
  useEffect(() => {
    let cancelled = false;
    myNickRef.current = getNick();
    unlockAudio();

    async function loadAll() {
      const [g, b, ps] = await Promise.all([
        supabase.from("games_public").select("*").eq("id", gameId).single(),
        supabase.from("bricks").select("*").eq("game_id", gameId).order("position"),
        supabase.from("player_states").select("*").eq("game_id", gameId),
      ]);
      if (cancelled) return;
      if (g.data) setGame(g.data as unknown as Game);
      if (b.data) setBricks(b.data as BrickRow[]);
      if (ps.data) {
        const me = (ps.data as PlayerState[]).find((p) => p.client_id === clientId);
        const opp = (ps.data as PlayerState[]).find((p) => p.client_id !== clientId);
        if (me) setMyState(me);
        if (opp) setOppState(opp);
      }
    }
    loadAll();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          setGame((prev) => (prev ? ({ ...prev, ...(payload.new as Game) }) : (payload.new as Game)));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bricks", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const nb = payload.new as BrickRow;
          const old = bricksRef.current.find((b) => b.position === nb.position);
          const ms = mySideRef.current;
          if (ms) {
            const wasMine = ms === 1 ? !!old?.front_broken_at : !!old?.back_broken_at;
            const isMine = ms === 1 ? !!nb.front_broken_at : !!nb.back_broken_at;
            if (!wasMine && isMine) {
              // Il mio lato si è appena rotto (può essere triggered da un altro update concorrente
              // -- es. dinamite che rompe via cascade)
              play("smash");
              if (nb.taken_by === ms && nb.revealed_content === "coin") {
                setTimeout(() => play("coin"), 120);
              }
            }
          }
          setBricks((prev) => prev.map((b) => (b.position === nb.position ? nb : b)));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "player_states", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const ns = payload.new as PlayerState;
          if (ns.client_id === clientId) setMyState(ns);
          else setOppState(ns);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase, clientId]);

  // Timer 250ms tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const endsAt = game?.ends_at ? new Date(game.ends_at).getTime() : null;
  const playingFromMs = game?.playing_from ? new Date(game.playing_from).getTime() : null;
  const inCountdown = playingFromMs ? now < playingFromMs : false;
  const countdownNum = playingFromMs
    ? Math.max(0, Math.ceil((playingFromMs - now) / 1000))
    : 0;
  // Banner "GO!" mostrato per ~600ms dopo che il countdown finisce
  const showGo =
    playingFromMs != null &&
    now >= playingFromMs &&
    now < playingFromMs + 600;
  // Il timer di gioco mostra max(0, endsAt - max(now, playingFrom)), quindi durante
  // il countdown resta fisso a 100s.
  const secondsLeft = endsAt
    ? Math.max(
        0,
        Math.floor((endsAt - Math.max(now, playingFromMs ?? now)) / 1000)
      )
    : 100;

  // Finalizza partita quando il timer scade OPPURE quando il server l'ha marcata finished
  useEffect(() => {
    if (!game) return;
    if (game.status === "finished" && !finalizedRef.current) {
      finalizedRef.current = true;
      setFinished(true);
      return;
    }
    if (endsAt && now >= endsAt && !finalizedRef.current) {
      finalizedRef.current = true;
      supabase.rpc("finalize_game", { p_game_id: gameId }).then(() => setFinished(true));
    }
  }, [now, endsAt, game, gameId, supabase]);

  // Cooldown effettivo: 1s tra colpi (server tollera 0.9s)
  const cooldownLeft = myState?.last_hit_at
    ? Math.max(0, new Date(myState.last_hit_at).getTime() + 1000 - now)
    : 0;
  const myEffects: ActiveEffect[] = myState?.active_effects ?? [];

  // L'avversario non vede il mio score se ho fantasma attivo sui MIEI effetti
  const oppCanSeeMyScore = !myEffects.some(
    (e) =>
      e.type === "fantasma" &&
      e.expires_at &&
      new Date(e.expires_at).getTime() > now
  );

  // Tap su mattone
  const onTapBrick = useCallback(
    async (position: number) => {
      if (finished || cooldownLeft > 0) return;
      if (inCountdown) return;
      if (!myState || myState.shots_remaining <= 0) return;
      play("hit");
      const { data, error } = await supabase.rpc("hit_brick", {
        p_client_id: clientId,
        p_position: position,
      });
      if (error) return;
      const d = data as {
        ok: boolean;
        my_side_broken?: boolean;
        outcome?: "won" | "lost" | "opp_taken" | null;
        content?: BrickContent | null;
        blast_position?: number | null;
        xray?: number[];
      };
      if (!d?.ok) {
        play("crack");
        return;
      }
      if (d.my_side_broken && d.content) {
        // Coin animation locale
        if (d.outcome === "won" && d.content === "coin") {
          setLastWonCoinAt({ position, ts: Date.now() });
        }
        // Banner enfatico per i powerup
        if (d.outcome === "won" && d.content !== "coin" && d.content !== "empty") {
          setFlash({ kind: "found", content: d.content, id: Date.now() });
          const isBonus = BONUS.includes(d.content);
          setTimeout(() => play(isBonus ? "bonus" : "malus"), 60);
        } else if (d.outcome === "lost") {
          setFlash({ kind: "lost", content: d.content ?? undefined, id: Date.now() });
          setTimeout(() => play("collision"), 60);
        }
        // outcome === "opp_taken": nessun banner. Il muro è semplicemente "bucato",
        // l'utente non deve sapere cosa c'era.
      } else {
        play("crack");
      }
      // Raggi-X: rivelo le 3 posizioni localmente
      if (d.xray && Array.isArray(d.xray) && d.xray.length > 0) {
        const next = new Map(revealedPositions);
        for (const p of d.xray) next.set(p, "empty");
        setRevealedPositions(next);
      }
    },
    [clientId, cooldownLeft, finished, inCountdown, myState, revealedPositions, supabase]
  );

  // Accredito monete a fine partita (una sola volta)
  useEffect(() => {
    if (!finished || !game || !mySide || coinsCreditedRef.current) return;
    coinsCreditedRef.current = true;
    const myCoins = mySide === 1 ? game.player1_coins : game.player2_coins;
    if (myCoins > 0) addCoins(myCoins);
    const oppCoins = mySide === 1 ? game.player2_coins : game.player1_coins;
    if (myCoins > oppCoins) play("win");
    else if (myCoins < oppCoins) play("lose");
  }, [finished, game, mySide]);

  if (!game || !mySide) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6">
        <p className="text-3xl text-white comic-text-stroke">Carico la partita...</p>
      </main>
    );
  }

  const myCoins = mySide === 1 ? game.player1_coins : game.player2_coins;
  const oppCoins = mySide === 1 ? game.player2_coins : game.player1_coins;
  const myNick = mySide === 1 ? game.player1_nick : game.player2_nick;
  const oppNick = mySide === 1 ? game.player2_nick : game.player1_nick;

  const oppEffects: ActiveEffect[] = oppState?.active_effects ?? [];
  const iCanSeeOppScore = !oppEffects.some(
    (e) =>
      e.type === "fantasma" &&
      e.expires_at &&
      new Date(e.expires_at).getTime() > now
  );

  return (
    <main className="min-h-dvh flex flex-col select-none">
      <Hud
        secondsLeft={secondsLeft}
        myNick={myNick ?? "?"}
        oppNick={oppNick ?? "?"}
        myCoins={myCoins}
        oppCoins={oppCoins}
        myShotsLeft={myState?.shots_remaining ?? 50}
        cooldownLeft={cooldownLeft}
        showOppScore={iCanSeeOppScore}
        oppCanSeeMyScore={oppCanSeeMyScore}
      />

      <ActiveEffectsBar effects={myEffects} now={now} />

      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <BrickWall
          bricks={bricks}
          mySide={mySide}
          onTap={onTapBrick}
          disabled={
            finished ||
            inCountdown ||
            cooldownLeft > 0 ||
            (myState?.shots_remaining ?? 0) <= 0
          }
          revealed={revealedPositions}
        />
      </div>

      <AnimatePresence>
        {flash && (
          <PowerUpBanner
            key={flash.id}
            kind={flash.kind}
            content={flash.content}
            onDone={() => setFlash(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finished && (
          <GameOverModal
            myCoins={myCoins}
            oppCoins={oppCoins}
            myNick={myNick ?? "?"}
            oppNick={oppNick ?? "?"}
            onPlayAgain={() => router.replace("/lobby")}
            onHome={() => router.replace("/")}
          />
        )}
      </AnimatePresence>

      {/* Countdown pre-partita 3-2-1-GO! */}
      <AnimatePresence>
        {(inCountdown || showGo) && (
          <motion.div
            key="countdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-none"
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={inCountdown ? `n-${countdownNum}` : "go"}
                initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: -2 }}
                exit={{ scale: 1.8, opacity: 0, rotate: 6 }}
                transition={{ type: "spring", stiffness: 360, damping: 18 }}
                className="text-center"
              >
                {inCountdown ? (
                  <div className="flex flex-col items-center">
                    <div className="text-[28vw] sm:text-[180px] leading-none text-white comic-text-stroke-lg">
                      {countdownNum}
                    </div>
                    <div className="mt-2 text-2xl text-white comic-text-stroke">
                      Pronti...
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="text-[22vw] sm:text-[140px] leading-none text-comic-green comic-text-stroke-lg">
                      GO!
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animazione moneta verso HUD */}
      <AnimatePresence>
        {lastWonCoinAt && (
          <motion.div
            key={`coin-${lastWonCoinAt.position}-${lastWonCoinAt.ts}`}
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 0, scale: 0.5, y: -200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            onAnimationComplete={() => setLastWonCoinAt(null)}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-5xl text-coin comic-text-stroke-lg"
          >
            +1 ¢
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulsante "?" per aprire la legenda */}
      <button
        onClick={() => setShowLegend(true)}
        aria-label="Legenda bonus e malus"
        className="fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-comic-purple text-white text-2xl font-extrabold comic-border-thin shadow-lg active:translate-y-0.5 transition"
      >
        ?
      </button>

      {/* Modal Legenda */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            key="legend-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowLegend(false)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 py-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 30 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-paper rounded-2xl comic-border p-4 pb-6"
            >
              <div className="flex items-center justify-between mb-3 sticky top-0 bg-paper pt-1 pb-2 -mt-1">
                <h2 className="text-2xl text-brick-edge font-bold">Legenda</h2>
                <button
                  onClick={() => setShowLegend(false)}
                  aria-label="Chiudi"
                  className="w-9 h-9 rounded-full bg-brick-edge text-white text-xl comic-border-thin active:translate-y-0.5"
                >
                  ✕
                </button>
              </div>
              <PowerupLegend />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
