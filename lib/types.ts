export type BrickContent =
  | "coin"
  | "empty"
  | "pistola"
  | "dinamite"
  | "raggi-x"
  | "scudo"
  | "quadrifoglio"
  | "scalpello"
  | "gabbia"
  | "doppia-gabbia"
  | "fantasma";

export const POWERUP_POOL: BrickContent[] = [
  "pistola",
  "dinamite",
  "raggi-x",
  "scudo",
  "quadrifoglio",
  "scalpello",
  "gabbia",
  "doppia-gabbia",
  "fantasma",
];

export const BONUS: BrickContent[] = [
  "pistola",
  "dinamite",
  "raggi-x",
  "scudo",
  "quadrifoglio",
];
export const MALUS: BrickContent[] = [
  "scalpello",
  "gabbia",
  "doppia-gabbia",
  "fantasma",
];

export type PlayerSide = 1 | 2;

export interface Game {
  id: string;
  status: "waiting" | "playing" | "finished";
  started_at: string | null;
  ends_at: string | null;
  player1_nick: string | null;
  player2_nick: string | null;
  player1_coins: number;
  player2_coins: number;
  player1_id: string | null;
  player2_id: string | null;
  powerups: string[] | null;
}

export interface BrickRow {
  game_id: string;
  position: number;
  front_hits: number;
  back_hits: number;
  /** true quando ENTRAMBI i lati sono rotti (derivato server-side) */
  broken: boolean;
  /** Timestamp ISO quando G1 ha rotto il suo lato; null se intatto */
  front_broken_at: string | null;
  /** Timestamp ISO quando G2 ha rotto il suo lato; null se intatto */
  back_broken_at: string | null;
  revealed_content: BrickContent | null;
  /** null = ancora intatto, 0 = perso per collisione, 1/2 = preso da quel giocatore */
  taken_by: number | null;
}

export interface ActiveEffect {
  type: BrickContent;
  expires_at?: string;
  shots_left?: number;
  revealed_positions?: number[];
}

export interface PlayerState {
  game_id: string;
  player: PlayerSide;
  client_id: string;
  last_hit_at: string | null;
  shots_remaining: number;
  active_effects: ActiveEffect[];
}

export interface LobbyRow {
  id: string;
  nick: string;
  client_id: string;
  joined_at: string;
}

export const POWERUP_LABELS: Record<BrickContent, string> = {
  coin: "Moneta",
  empty: "Vuoto",
  pistola: "Pistola",
  dinamite: "Dinamite",
  "raggi-x": "Raggi X",
  scudo: "Scudo",
  quadrifoglio: "Quadrifoglio",
  scalpello: "Scalpello",
  gabbia: "Gabbia",
  "doppia-gabbia": "Doppia Gabbia",
  fantasma: "Fantasma",
};

export const POWERUP_DESCRIPTIONS: Record<BrickContent, string> = {
  coin: "",
  empty: "",
  pistola: "Per 2 colpi, rompi i mattoni in uno solo",
  dinamite: "Rompe anche un mattone adiacente",
  "raggi-x": "Rivela il contenuto di 3 mattoni",
  scudo: "Blocca il prossimo malus",
  quadrifoglio: "Blocca l'avversario per 2s",
  scalpello: "Per 2 colpi servono 3 hit",
  gabbia: "Bloccato per 2s",
  "doppia-gabbia": "Bloccato per 4s",
  fantasma: "Punteggio nascosto all'avversario",
};
