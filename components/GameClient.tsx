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
import BrickWall from "./BrickWall";
import Hud from "./Hud";
import PowerUpBanner from "./PowerUpBanner";
import GameOverModal from "./GameOverModal";

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
  const [lastResult, setLastResult] = useState<{
    content: BrickContent | null;
    position: number | null;
    broken: boolean;
  } | null>(null);
  const [flashEffect, setFlashEffect] = useState<{
    type: BrickContent;
    id: number;
  } | null>(null);
  const [revealedPositions, setRevealedPositions] = useState<Map<number, BrickContent>>(
    new Map()
  );
  const finalizedRef = useRef(false);
  const coinsCreditedRef = useRef(false);

  const mySide: 1 | 2 | null =
    game?.player1_id === clientId ? 1 : game?.player2_id === clientId ? 2 : null;
  const oppSide: 1 | 2 | null = mySide === 1 ? 2 : mySide === 2 ? 1 : null;

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
          setBricks((prev) => prev.map((b) => (b.position === nb.position ? nb : b)));
          if (nb.broken && nb.revealed_content) {
            // suono di rottura + suono contenuto
            play("smash");
            if (nb.revealed_content === "coin") setTimeout(() => play("coin"), 120);
          }
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

  // Timer 1s tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const endsAt = game?.ends_at ? new Date(game.ends_at).getTime() : null;
  const secondsLeft = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 100;

  // Finalizza partita quando il timer scade
  useEffect(() => {
    if (!game || !endsAt) return;
    if (now >= endsAt && !finalizedRef.current) {
      finalizedRef.current = true;
      supabase.rpc("finalize_game", { p_game_id: gameId }).then(() => setFinished(true));
    }
  }, [now, endsAt, game, gameId, supabase]);

  // Cooldown effettivo
  const cooldownLeft = myState?.last_hit_at
    ? Math.max(0, new Date(myState.last_hit_at).getTime() + 2000 - now)
    : 0;
  const myEffects: ActiveEffect[] = myState?.active_effects ?? [];

  // Verifica se l'avversario sta nascondendo il mio punteggio (fantasma nei MIEI effetti)
  const oppCanSeeMyScore = !myEffects.some(
    (e) =>
      e.type === "fantasma" &&
      e.expires_at &&
      new Date(e.expires_at).getTime() > now
  );

  // Pre-raggi-x: contenuti rivelati per il mio lato (locale, solo per me)
  useEffect(() => {
    const xray = myEffects.find((e) => e.type === "raggi-x");
    if (!xray || !Array.isArray(xray.revealed_positions ?? (xray as unknown as { revealed?: number[] }).revealed))
      return;
    const positions =
      (xray.revealed_positions as number[] | undefined) ??
      ((xray as unknown as { revealed?: number[] }).revealed ?? []);
    if (positions.length === 0) return;
    const next = new Map(revealedPositions);
    let changed = false;
    for (const pos of positions) {
      if (!next.has(pos) && game?.id) {
        // Recupero contenuto via select su game.wall — solo per le posizioni ricevute,
        // ma games_public NON espone wall. Quindi gestisco solo lato server via marcatura
        // sui bricks: in v0 mostriamo solo "?!" colorato per quei mattoni.
        next.set(pos, "empty");
        changed = true;
      }
    }
    if (changed) setRevealedPositions(next);
  }, [myEffects, game?.id, revealedPositions]);

  // Tap su mattone
  const onTapBrick = useCallback(
    async (position: number) => {
      if (finished || cooldownLeft > 0) return;
      if (!myState || myState.shots_remaining <= 0) return;
      play("hit");
      const { data, error } = await supabase.rpc("hit_brick", {
        p_client_id: clientId,
        p_position: position,
      });
      if (error) return;
      const d = data as {
        ok: boolean;
        broken?: boolean;
        content?: BrickContent | null;
        blast_position?: number | null;
        xray?: number[];
      };
      if (!d?.ok) return;
      if (d.broken && d.content) {
        setLastResult({ content: d.content, position, broken: true });
        // Suoni gestiti da realtime UPDATE; qui solo flash UI
        if (d.content === "coin") {
          /* gestito via realtime */
        } else if (d.content !== "empty") {
          setFlashEffect({ type: d.content, id: Date.now() });
          // Bonus per me OR malus per me OR malus su avversario
          const isBonus = ["pistola", "dinamite", "raggi-x", "scudo", "quadrifoglio"].includes(
            d.content
          );
          setTimeout(() => play(isBonus ? "bonus" : "malus"), 80);
        }
      } else {
        play("crack");
      }
      // Raggi X: salvo localmente le 3 posizioni rivelate (solo lato mio)
      if (d.xray && Array.isArray(d.xray) && d.xray.length > 0) {
        // Per la beta, marco semplicemente come "rivelato" senza esporre il contenuto
        const next = new Map(revealedPositions);
        for (const p of d.xray) next.set(p, "empty");
        setRevealedPositions(next);
      }
    },
    [clientId, cooldownLeft, finished, myState, revealedPositions, supabase]
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

  // L'avversario può nascondermi il suo score (fantasma nei suoi effetti?) — gestito server-side già
  // Qui controllo: i MIEI effetti contengono "fantasma" attivo che nasconde il MIO punteggio
  // all'avversario. Per simmetria, l'avversario può avermi fatto fantasma → io NON vedo il suo punteggio.
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
        myEffects={myEffects}
      />

      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <BrickWall
          bricks={bricks}
          mySide={mySide}
          onTap={onTapBrick}
          disabled={finished || cooldownLeft > 0 || (myState?.shots_remaining ?? 0) <= 0}
          revealed={revealedPositions}
        />
      </div>

      <AnimatePresence>
        {flashEffect && (
          <PowerUpBanner
            key={flashEffect.id}
            type={flashEffect.type}
            onDone={() => setFlashEffect(null)}
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

      {/* Animazione moneta verso HUD (semplice) */}
      <AnimatePresence>
        {lastResult?.content === "coin" && lastResult.position != null && (
          <motion.div
            key={`coin-${lastResult.position}-${Date.now()}`}
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 0, scale: 0.5, y: -200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-5xl text-coin comic-text-stroke-lg"
          >
            +1 ¢
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
