"use client";
import type { BrickContent } from "@/lib/types";
import { POWERUP_LABELS, POWERUP_DESCRIPTIONS } from "@/lib/types";
import PowerUpIcon from "./PowerUpIcon";

const BONUS_ITEMS: BrickContent[] = [
  "pistola",
  "dinamite",
  "raggi-x",
  "scudo",
  "quadrifoglio",
];
const MALUS_ITEMS: BrickContent[] = [
  "scalpello",
  "gabbia",
  "doppia-gabbia",
  "fantasma",
];

interface Props {
  /** Stile compatto (dimensioni ridotte) */
  compact?: boolean;
  /** Mostrare anche la moneta in cima */
  includeCoin?: boolean;
}

export default function PowerupLegend({ compact = false, includeCoin = true }: Props) {
  const iconSize = compact ? 28 : 36;
  return (
    <div className="w-full">
      {includeCoin && (
        <div className="mb-3">
          <Row
            type="coin"
            label="Moneta"
            description="Vale 1 punto. Chi raccoglie più monete vince."
            color="bg-coin/20"
            iconSize={iconSize}
            compact={compact}
          />
        </div>
      )}

      <SectionTitle title="Bonus per chi lo trova" tone="bonus" />
      <div className="space-y-1.5 mb-3">
        {BONUS_ITEMS.map((t) => (
          <Row
            key={t}
            type={t}
            label={POWERUP_LABELS[t]}
            description={POWERUP_DESCRIPTIONS[t]}
            color="bg-comic-green/15"
            iconSize={iconSize}
            compact={compact}
          />
        ))}
      </div>

      <SectionTitle title="Malus per chi lo trova" tone="malus" />
      <div className="space-y-1.5">
        {MALUS_ITEMS.map((t) => (
          <Row
            key={t}
            type={t}
            label={POWERUP_LABELS[t]}
            description={POWERUP_DESCRIPTIONS[t]}
            color="bg-crack/15"
            iconSize={iconSize}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  tone,
}: {
  title: string;
  tone: "bonus" | "malus";
}) {
  return (
    <div
      className={`inline-block px-3 py-1 mb-2 rounded-md comic-border-thin ${
        tone === "bonus" ? "bg-comic-green" : "bg-crack"
      }`}
    >
      <span className="text-white text-sm uppercase tracking-wider comic-text-stroke">
        {title}
      </span>
    </div>
  );
}

function Row({
  type,
  label,
  description,
  color,
  iconSize,
  compact,
}: {
  type: BrickContent;
  label: string;
  description: string;
  color: string;
  iconSize: number;
  compact: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl comic-border-thin px-2.5 py-1.5 ${color}`}
    >
      <div className="bg-paper rounded-lg p-1 comic-border-thin shrink-0">
        <PowerUpIcon type={type} size={iconSize} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`${
            compact ? "text-sm" : "text-base"
          } font-bold text-brick-edge leading-tight`}
        >
          {label}
        </div>
        {description && (
          <div
            className={`${
              compact ? "text-xs" : "text-sm"
            } text-brick-edge/80 leading-tight`}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
