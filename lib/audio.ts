"use client";

type Key =
  | "hit"
  | "crack"
  | "smash"
  | "coin"
  | "bonus"
  | "malus"
  | "win"
  | "lose";

let ctx: AudioContext | null = null;
let unlocked = false;
let masterGain: GainNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx =
      (window.AudioContext as typeof AudioContext | undefined) ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  if (unlocked) return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  // dummy silent buffer per sbloccare iOS
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  unlocked = true;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  vol = 0.3,
  attack = 0.005,
  decay = 0.06,
  freqEnd?: number
) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + duration);
  osc.connect(g).connect(masterGain);
  osc.start(t);
  osc.stop(t + attack + duration + 0.05);
}

function noise(duration: number, vol = 0.4, lowpass = 1000) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const t = c.currentTime;
  const bufLen = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(lp).connect(g).connect(masterGain);
  src.start(t);
}

export function play(key: Key) {
  if (typeof window === "undefined") return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  try {
    switch (key) {
      case "hit":
        // tap legnoso
        tone(260, 0.05, "square", 0.18, 0.002, 0.04, 160);
        noise(0.04, 0.15, 1200);
        break;
      case "crack":
        // vetro che si incrina
        tone(900, 0.07, "triangle", 0.22, 0.002, 0.05, 1500);
        noise(0.08, 0.25, 4000);
        break;
      case "smash":
        // rottura piena: thump + crash
        tone(120, 0.12, "sawtooth", 0.35, 0.002, 0.1, 50);
        noise(0.18, 0.4, 2500);
        tone(700, 0.1, "square", 0.18, 0.002, 0.08, 200);
        break;
      case "coin":
        // jingle moneta: due note rapide ascendenti
        tone(880, 0.08, "square", 0.28, 0.002, 0.06);
        setTimeout(() => tone(1320, 0.18, "square", 0.32, 0.002, 0.15), 60);
        break;
      case "bonus":
        // arpeggio breve up
        tone(523, 0.08, "triangle", 0.3, 0.002, 0.06);
        setTimeout(() => tone(659, 0.08, "triangle", 0.3, 0.002, 0.06), 70);
        setTimeout(() => tone(784, 0.14, "triangle", 0.35, 0.002, 0.12), 140);
        break;
      case "malus":
        // discendente, suono "cattivo"
        tone(330, 0.18, "sawtooth", 0.32, 0.002, 0.15, 110);
        noise(0.1, 0.2, 600);
        break;
      case "win":
        tone(523, 0.1, "square", 0.3, 0.002, 0.08);
        setTimeout(() => tone(659, 0.1, "square", 0.3, 0.002, 0.08), 100);
        setTimeout(() => tone(784, 0.1, "square", 0.3, 0.002, 0.08), 200);
        setTimeout(() => tone(1047, 0.25, "square", 0.35, 0.002, 0.22), 300);
        break;
      case "lose":
        tone(330, 0.12, "sawtooth", 0.3, 0.002, 0.1, 220);
        setTimeout(() => tone(247, 0.12, "sawtooth", 0.3, 0.002, 0.1, 175), 130);
        setTimeout(() => tone(196, 0.3, "sawtooth", 0.35, 0.002, 0.25, 100), 260);
        break;
    }
  } catch {
    /* noop */
  }
}
