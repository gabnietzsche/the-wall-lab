"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return _client;
}

const CLIENT_ID_KEY = "the-wall:client-id";
const NICK_KEY = "the-wall:nick";
const COINS_KEY = "the-wall:coins";
const SKIN_KEY = "the-wall:skin";
const DEFAULT_SKIN = "ladro";

export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getNick(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICK_KEY) || "";
}

export function setNick(nick: string) {
  localStorage.setItem(NICK_KEY, nick.slice(0, 20));
}

export function getTotalCoins(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(COINS_KEY) || "0", 10);
}

export function addCoins(n: number) {
  const cur = getTotalCoins();
  localStorage.setItem(COINS_KEY, String(cur + n));
}

export function getSkin(): string {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  return localStorage.getItem(SKIN_KEY) || DEFAULT_SKIN;
}

export function setSkin(skin: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SKIN_KEY, skin.slice(0, 20));
}
