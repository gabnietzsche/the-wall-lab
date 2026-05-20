"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { ActiveEffect, BrickContent } from "@/lib/types";
import { BONUS } from "@/lib/types";
import PowerUpIcon from "./PowerUpIcon";

interface Props {
  effects: ActiveEffect[];
  now: number;
}

/**
 * Banda persistente sotto l'HUD: mostra i bonus/malus attivi sul giocatore
 * con icona, etichetta e contatore + breve spiegazione di cosa fa adesso.
 */
export default function ActiveEffectsBar({ effects, now }: Props) {
  // Filtro effetti rilevanti: pistola, scalpello, scudo. Fantasma (sui miei) = il mio score è
  // nascosto all'avversario fino a expires_at.
  const items = effects.flatMap((e) => buildItem(e, now));

  return (
    <div className="px-3 min-h-[44px]">
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex gap-2 flex-wrap items-stretch"
          >
            {items.map((it, i) => (
              <motion.div
                key={`${it.type}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={`flex items-center gap-2 px-2 py-1 rounded-xl comic-border-thin ${
                  it.isBonus ? "bg-comic-green" : "bg-crack"
                }`}
              >
                <div className="bg-paper/95 rounded-lg p-0.5 comic-border-thin">
                  <PowerUpIcon type={it.type} size={28} />
                </div>
                <div className="leading-tight">
                  <div className="text-white text-sm font-bold comic-text-stroke">
                    {it.label}
                  </div>
                  <div className="text-white/90 text-[10px] comic-text-stroke">
                    {it.detail}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Item {
  type: BrickContent;
  label: string;
  detail: string;
  isBonus: boolean;
}

function buildItem(e: ActiveEffect, now: number): Item[] {
  switch (e.type) {
    case "pistola":
      if ((e.shots_left ?? 0) <= 0) return [];
      return [
        {
          type: "pistola",
          label: "Pistola",
          detail: `Rompi in 1 colpo — ${e.shots_left} rimasti`,
          isBonus: BONUS.includes("pistola"),
        },
      ];
    case "scudo":
      return [
        {
          type: "scudo",
          label: "Scudo",
          detail: "Blocca il prossimo malus",
          isBonus: true,
        },
      ];
    case "raggi-x":
      // L'effetto è istantaneo (3 rivelati). Skip dal banner persistente.
      return [];
    case "x2-coins": {
      const exp = e.expires_at ? new Date(e.expires_at).getTime() : 0;
      const remaining = Math.max(0, Math.ceil((exp - now) / 1000));
      if (remaining <= 0) return [];
      return [
        {
          type: "x2-coins",
          label: "Moltiplicatore x2",
          detail: `Ogni moneta vale doppio — ${remaining}s`,
          isBonus: true,
        },
      ];
    }
    case "fantasma": {
      const exp = e.expires_at ? new Date(e.expires_at).getTime() : 0;
      const remaining = Math.max(0, Math.ceil((exp - now) / 1000));
      if (remaining <= 0) return [];
      return [
        {
          type: "fantasma",
          label: "Fantasma",
          detail: `Il tuo punteggio è nascosto — ${remaining}s`,
          isBonus: false,
        },
      ];
    }
    default:
      return [];
  }
}
