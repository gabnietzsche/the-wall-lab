"use client";
import type { SkinId } from "@/lib/types";

interface Props {
  id: string;
  /** Default: 64. */
  size?: number;
  /**
   * "color": versione colorata pop (per home / HUD)
   * "silhouette": versione mono per sagoma dietro al muro
   */
  variant?: "color" | "silhouette";
  className?: string;
}

export const PLAYER_SKINS: { id: SkinId; label: string }[] = [
  { id: "ladro", label: "Ladro" },
  { id: "operaio", label: "Operaio" },
  { id: "boss", label: "Boss" },
  { id: "pirata", label: "Pirata" },
  { id: "ninja", label: "Ninja" },
  { id: "clown", label: "Clown" },
];

/**
 * 6 sagome stilizzate "comic". Ognuna è una mezza figura (testa + spalle)
 * con un dettaglio identificativo (passamontagna, elmetto, ecc.).
 *
 * - viewBox 0 0 100 100
 * - in "color" usa la sua palette
 * - in "silhouette" diventa un blob scuro (color brick-edge) con un piccolo highlight
 */
export default function PlayerSkin({ id, size = 64, variant = "color", className = "" }: Props) {
  const stroke = "#3A2410"; // brick-edge
  const isSil = variant === "silhouette";

  // In silhouette uso fill compatto, niente colori
  const silFill = "#3A2410";
  const silAccent = "#5a3a1a";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-label={id}>
      {/* spalle */}
      <path
        d="M 10 95 Q 10 70 30 65 L 70 65 Q 90 70 90 95 Z"
        fill={isSil ? silFill : "#FFE3A8"}
        stroke={isSil ? "transparent" : stroke}
        strokeWidth={isSil ? 0 : 3}
      />
      {/* testa */}
      <circle
        cx="50"
        cy="42"
        r="22"
        fill={isSil ? silFill : skinTone(id)}
        stroke={isSil ? "transparent" : stroke}
        strokeWidth={isSil ? 0 : 3}
      />

      {/* dettaglio per skin */}
      {id === "ladro" && (
        <>
          {/* passamontagna nero */}
          <path
            d="M 30 30 Q 50 18 70 30 L 70 50 L 30 50 Z"
            fill={isSil ? silAccent : "#1a1a1a"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          {/* slot occhi */}
          <rect x="36" y="38" width="11" height="5" rx="2" fill={isSil ? silFill : "#FFF8E7"} />
          <rect x="53" y="38" width="11" height="5" rx="2" fill={isSil ? silFill : "#FFF8E7"} />
        </>
      )}

      {id === "operaio" && (
        <>
          {/* elmetto giallo */}
          <path
            d="M 24 32 Q 50 8 76 32 L 76 38 L 24 38 Z"
            fill={isSil ? silAccent : "#F5B400"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 3}
          />
          <rect x="24" y="36" width="52" height="4" fill={isSil ? silFill : "#C99A1F"} />
          {/* baffi */}
          {!isSil && (
            <path d="M 38 56 Q 50 60 62 56" stroke={stroke} strokeWidth="2.5" fill="none" />
          )}
        </>
      )}

      {id === "boss" && (
        <>
          {/* cilindro */}
          <rect
            x="32"
            y="6"
            width="36"
            height="22"
            fill={isSil ? silAccent : "#1a1a1a"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 3}
          />
          <rect
            x="28"
            y="26"
            width="44"
            height="6"
            fill={isSil ? silAccent : "#1a1a1a"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 3}
          />
          {/* baffi a manubrio */}
          {!isSil && (
            <path
              d="M 30 55 Q 40 50 50 55 Q 60 50 70 55"
              stroke={stroke}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </>
      )}

      {id === "pirata" && (
        <>
          {/* bandana rossa */}
          <path
            d="M 26 30 Q 50 18 74 30 L 74 38 Q 50 30 26 38 Z"
            fill={isSil ? silAccent : "#E63946"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 3}
          />
          {!isSil && (
            <>
              {/* pois bianchi sulla bandana */}
              <circle cx="38" cy="29" r="2" fill="#FFF8E7" />
              <circle cx="60" cy="27" r="2" fill="#FFF8E7" />
            </>
          )}
          {/* benda nera */}
          <path
            d="M 30 45 L 50 38 L 50 52 L 30 50 Z"
            fill={isSil ? silAccent : "#1a1a1a"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          {/* occhio destro */}
          {!isSil && <circle cx="60" cy="45" r="2.5" fill={stroke} />}
        </>
      )}

      {id === "ninja" && (
        <>
          {/* maschera che copre tutto tranne gli occhi */}
          <path
            d="M 28 28 Q 50 14 72 28 L 76 60 Q 50 70 24 60 Z"
            fill={isSil ? silAccent : "#1a1a1a"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 3}
          />
          {/* slot occhi sottile */}
          <rect
            x="32"
            y="42"
            width="36"
            height="6"
            rx="3"
            fill={isSil ? silFill : skinTone(id)}
          />
          {!isSil && (
            <>
              <circle cx="42" cy="45" r="2.2" fill={stroke} />
              <circle cx="58" cy="45" r="2.2" fill={stroke} />
              {/* fascia rossa */}
              <rect x="24" y="32" width="52" height="3" fill="#E63946" />
            </>
          )}
        </>
      )}

      {id === "clown" && (
        <>
          {/* chioma arancione esplosa */}
          <circle
            cx="30"
            cy="34"
            r="10"
            fill={isSil ? silAccent : "#FF6B35"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          <circle
            cx="70"
            cy="34"
            r="10"
            fill={isSil ? silAccent : "#FF6B35"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          <circle
            cx="22"
            cy="42"
            r="7"
            fill={isSil ? silAccent : "#FF6B35"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          <circle
            cx="78"
            cy="42"
            r="7"
            fill={isSil ? silAccent : "#FF6B35"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          {/* naso rosso */}
          <circle
            cx="50"
            cy="50"
            r="5"
            fill={isSil ? silAccent : "#E63946"}
            stroke={isSil ? "transparent" : stroke}
            strokeWidth={isSil ? 0 : 2.5}
          />
          {/* sorriso */}
          {!isSil && (
            <path
              d="M 38 58 Q 50 66 62 58"
              stroke={stroke}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </>
      )}
    </svg>
  );
}

function skinTone(id: string): string {
  // toni di pelle/base diversi per dare varietà
  switch (id) {
    case "ladro":
      return "#FFD8A8";
    case "operaio":
      return "#F0BC8F";
    case "boss":
      return "#E8B485";
    case "pirata":
      return "#D49A6A";
    case "ninja":
      return "#FFE3B8";
    case "clown":
      return "#FFF8E7";
    default:
      return "#FFD8A8";
  }
}
