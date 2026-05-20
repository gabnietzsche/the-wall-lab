"use client";
import type { BrickContent } from "@/lib/types";

interface Props {
  type: BrickContent;
  size?: number;
  className?: string;
}

/**
 * Icone SVG in stile comic per i powerup.
 * Colori coerenti con il sistema esistente (BONUS verde-ish, MALUS rosso-ish).
 */
export default function PowerUpIcon({ type, size = 32, className = "" }: Props) {
  const stroke = "#1a0d05";
  const sw = 2; // stroke width

  const w = size;
  const h = size;

  switch (type) {
    case "coin":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="14" fill="#F5B400" stroke={stroke} strokeWidth={sw} />
          <circle cx="20" cy="20" r="9" fill="#FFD700" stroke={stroke} strokeWidth="1.4" />
          <text x="20" y="26" textAnchor="middle" fontSize="14" fontWeight="900" fill={stroke}>
            ¢
          </text>
        </svg>
      );

    case "pistola":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          {/* manico */}
          <path
            d="M 14 22 L 14 33 L 22 33 L 22 26 L 26 26"
            fill="#FF4D8D"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* canna */}
          <rect x="14" y="14" width="20" height="8" fill="#FF4D8D" stroke={stroke} strokeWidth={sw} />
          {/* tacca */}
          <rect x="16" y="11" width="3" height="3" fill={stroke} />
          {/* lampo all'uscita */}
          <path d="M 34 18 L 38 16 L 36 19 L 39 21 L 35 20 Z" fill="#FFE600" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );

    case "dinamite":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          {/* candelotto */}
          <rect x="11" y="14" width="18" height="20" fill="#E63946" stroke={stroke} strokeWidth={sw} rx="2" />
          <rect x="11" y="18" width="18" height="2" fill={stroke} />
          <rect x="11" y="28" width="18" height="2" fill={stroke} />
          <text x="20" y="27" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff">
            TNT
          </text>
          {/* miccia */}
          <path
            d="M 20 14 Q 22 8 26 7"
            fill="none"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* scintilla */}
          <circle cx="27" cy="6" r="2.5" fill="#FFE600" stroke={stroke} strokeWidth="1.2" />
          <path d="M 25 4 L 26 6 M 29 4 L 27.5 6 M 30 8 L 28 7" stroke="#FFE600" strokeWidth="1" />
        </svg>
      );

    case "raggi-x":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          {/* raggi */}
          {[0, 45, 90, 135].map((deg) => (
            <line
              key={deg}
              x1="20"
              y1="20"
              x2={20 + 18 * Math.cos((deg * Math.PI) / 180)}
              y2={20 + 18 * Math.sin((deg * Math.PI) / 180)}
              stroke="#9D5BE8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
          {[180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="20"
              y1="20"
              x2={20 + 18 * Math.cos((deg * Math.PI) / 180)}
              y2={20 + 18 * Math.sin((deg * Math.PI) / 180)}
              stroke="#9D5BE8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
          {/* occhio */}
          <ellipse cx="20" cy="20" rx="8" ry="5" fill="#fff" stroke={stroke} strokeWidth={sw} />
          <circle cx="20" cy="20" r="3" fill="#9D5BE8" stroke={stroke} strokeWidth="1.2" />
          <circle cx="20" cy="20" r="1" fill={stroke} />
        </svg>
      );

    case "scudo":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          <path
            d="M 20 4 L 33 9 L 33 21 Q 33 30 20 36 Q 7 30 7 21 L 7 9 Z"
            fill="#4FB3FF"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <path
            d="M 14 19 L 18 23 L 26 14"
            stroke="#fff"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "quadrifoglio":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          {[0, 90, 180, 270].map((deg) => (
            <ellipse
              key={deg}
              cx="20"
              cy="13"
              rx="5.5"
              ry="7"
              fill="#5BC85B"
              stroke={stroke}
              strokeWidth={sw}
              transform={`rotate(${deg} 20 20)`}
            />
          ))}
          <circle cx="20" cy="20" r="2.5" fill="#2E8B2E" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );

    case "scalpello":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          {/* manico */}
          <rect
            x="22"
            y="6"
            width="6"
            height="20"
            fill="#8B5A2B"
            stroke={stroke}
            strokeWidth={sw}
            transform="rotate(15 25 16)"
          />
          {/* punta */}
          <path
            d="M 18 28 L 26 36 L 32 30 L 22 22 Z"
            fill="#B8B8B8"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* scintille */}
          <path d="M 8 34 L 12 30 M 6 28 L 10 28 M 10 36 L 14 34" stroke="#FFE600" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "gabbia":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          <rect x="6" y="8" width="28" height="26" fill="none" stroke={stroke} strokeWidth={sw} rx="2" />
          {[12, 18, 24, 30].map((x) => (
            <line key={x} x1={x} y1="8" x2={x} y2="34" stroke={stroke} strokeWidth="2.4" />
          ))}
          <line x1="6" y1="20" x2="34" y2="20" stroke={stroke} strokeWidth="2" />
          {/* lucchetto */}
          <rect x="17" y="18" width="6" height="6" fill="#666" stroke={stroke} strokeWidth="1.4" />
          <path d="M 18.5 18 L 18.5 16 Q 18.5 14 20 14 Q 21.5 14 21.5 16 L 21.5 18" fill="none" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );

    case "doppia-gabbia":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          <rect x="4" y="6" width="32" height="30" fill="none" stroke={stroke} strokeWidth={sw} rx="2" />
          {[10, 16, 22, 28, 34].map((x) => (
            <line key={`v${x}`} x1={x} y1="6" x2={x} y2="36" stroke={stroke} strokeWidth="2.2" />
          ))}
          {[12, 20, 28].map((y) => (
            <line key={`h${y}`} x1="4" y1={y} x2="36" y2={y} stroke={stroke} strokeWidth="2.2" />
          ))}
          {/* X grossa centrale */}
          <line x1="14" y1="14" x2="26" y2="26" stroke="#E63946" strokeWidth="3" strokeLinecap="round" />
          <line x1="26" y1="14" x2="14" y2="26" stroke="#E63946" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case "fantasma":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          <path
            d="M 8 18 Q 8 8 20 8 Q 32 8 32 18 L 32 32 L 28 36 L 24 32 L 20 36 L 16 32 L 12 36 L 8 32 Z"
            fill="#C8B8E8"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* occhi */}
          <ellipse cx="16" cy="18" rx="2" ry="3" fill={stroke} />
          <ellipse cx="24" cy="18" rx="2" ry="3" fill={stroke} />
          {/* bocca */}
          <ellipse cx="20" cy="25" rx="3" ry="2" fill={stroke} />
        </svg>
      );

    case "x2-coins":
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          {/* moneta retro */}
          <circle cx="14" cy="22" r="11" fill="#C99A1F" stroke={stroke} strokeWidth={sw} />
          {/* moneta fronte */}
          <circle cx="22" cy="18" r="11" fill="#F5B400" stroke={stroke} strokeWidth={sw} />
          <circle cx="22" cy="18" r="7" fill="#FFD700" stroke={stroke} strokeWidth="1.2" />
          <text x="22" y="22" textAnchor="middle" fontSize="10" fontWeight="900" fill={stroke}>
            ¢
          </text>
          {/* badge ×2 */}
          <circle cx="32" cy="10" r="7" fill="#E63946" stroke={stroke} strokeWidth={sw} />
          <text x="32" y="13" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">
            x2
          </text>
        </svg>
      );

    case "empty":
    default:
      return (
        <svg width={w} height={h} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="2" fill={stroke} opacity="0.3" />
        </svg>
      );
  }
}
