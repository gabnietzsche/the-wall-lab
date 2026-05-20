export type BrickContent =
  | "coin"
  | "empty"
  | "pistola"
  | "dinamite"
  | "raggi-x"
  | "scudo"
  | "quadrifoglio"
  | "x2-coins"
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
  "x2-coins",
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
  "x2-coins",
];
export const MALUS: BrickContent[] = [
  "gabbia",
  "doppia-gabbia",
  "fantasma",
];

export type PlayerSide = 1 | 2;

/** Skin del giocatore: id stabile usato in DB e nei componenti. */
export type SkinId =
  | "ladro"
  | "operaio"
  | "boss"
  | "pirata"
  | "ninja"
  | "clown";

export const SKIN_IDS: SkinId[] = [
  "ladro",
  "operaio",
  "boss",
  "pirata",
  "ninja",
  "clown",
];

export interface Game {
  id: string;
  status: "waiting" | "playing" | "finished";
  started_at: string | null;
  ends_at: string | null;
  /** Timestamp ISO da cui il gioco accetta colpi (3s dopo started_at). */
  playing_from: string | null;
  /** Timestamp ISO della scadenza overtime (sudden death); null se non in overtime. */
  overtime_until: string | null;
  player1_nick: string | null;
  player2_nick: string | null;
  player1_skin: string | null;
  player2_skin: string | null;
  player1_coins: number;
  player2_coins: number;
  player1_id: string | null;
  player2_id: string | null;
  powerups: string[] | null;
}

export interface BrickRow {
  game_id: string;
  position: number;
  /** Colpi dati dal player 1 su questo mattone */
  front_hits: number;
  /** Colpi dati dal player 2 su questo mattone */
  back_hits: number;
  /** true quando il mattone si è rotto (somma hits >= hits_needed) */
  broken: boolean;
  /** Soglia di colpi per rompere il mattone (random 2 o 3, settato alla creazione) */
  hits_needed: number;
  /** Timestamp ISO quando P1 ha dato l'ultimo colpo (solo se ha rotto lui); null altrimenti */
  front_broken_at: string | null;
  /** Timestamp ISO quando P2 ha dato l'ultimo colpo (solo se ha rotto lui); null altrimenti */
  back_broken_at: string | null;
  revealed_content: BrickContent | null;
  /** null = ancora intatto, 1/2 = giocatore che ha dato il colpo finale e preso il contenuto */
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
  /** Contatore combo: 0..2; al raggiungimento di 3 viene resettato e dà bonus moneta */
  streak: number;
}

export interface LobbyRow {
  id: string;
  nick: string;
  client_id: string;
  joined_at: string;
  skin: string | null;
}

export const POWERUP_LABELS: Record<BrickContent, string> = {
  coin: "Moneta",
  empty: "Vuoto",
  pistola: "Pistola",
  dinamite: "Dinamite",
  "raggi-x": "Raggi X",
  scudo: "Scudo",
  quadrifoglio: "Quadrifoglio",
  "x2-coins": "Moltiplicatore x2",
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
  "x2-coins": "Per 6 secondi ogni moneta vale doppio",
  scalpello: "Per 2 colpi servono 3 hit",
  gabbia: "Bloccato per 2s",
  "doppia-gabbia": "Bloccato per 4s",
  fantasma: "Punteggio nascosto all'avversario",
};
