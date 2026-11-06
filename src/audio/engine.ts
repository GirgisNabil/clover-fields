import { create } from "zustand";

// One AudioContext with four buses (master ← music, sfx, ambient), created on the first user
// gesture. Volumes are per device (localStorage).

export type Bus = "music" | "sfx" | "ambient";
export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  ambient: number;
}

const KEY = "cf:volume";
const DEFAULTS: Volumes = { master: 0.8, music: 0.45, sfx: 0.8, ambient: 0.5 };

function loadVolumes(): Volumes {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Volumes>) };
    // Older builds had a single mute switch.
    if (localStorage.getItem("cf:muted") === "1") return { ...DEFAULTS, master: 0 };
  } catch {
    // Storage blocked: defaults.
  }
  return DEFAULTS;
}

export const useVolumes = create<Volumes & { set(key: keyof Volumes, value: number): void }>(
  (set, get) => ({
    ...(typeof window === "undefined" ? DEFAULTS : loadVolumes()),
    set(key, value) {
      set({ [key]: value } as Partial<Volumes>);
      const { master, music, sfx, ambient } = get();
      try {
        localStorage.setItem(KEY, JSON.stringify({ master, music, sfx, ambient }));
      } catch {
        // Not persisted.
      }
      applyVolumes();
    },
  }),
);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buses: Partial<Record<Bus, GainNode>> = {};
const listeners: Array<(ctx: AudioContext) => void> = [];

/** Runs `fn` once audio is available (immediately if it already is). */
export function onAudioReady(fn: (ctx: AudioContext) => void) {
  if (ctx) fn(ctx);
  else listeners.push(fn);
}

export function audioContext(): AudioContext | null {
  return ctx;
}

export function bus(name: Bus): AudioNode | null {
  return buses[name] ?? null;
}

function applyVolumes() {
  if (!ctx || !master) return;
  const v = useVolumes.getState();
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(v.master, t, 0.05);
  buses.music?.gain.setTargetAtTime(v.music, t, 0.05);
  buses.sfx?.gain.setTargetAtTime(v.sfx, t, 0.05);
  buses.ambient?.gain.setTargetAtTime(v.ambient, t, 0.05);
}

/** Creates the context on the first user gesture (browsers block audio before that). */
export function unlockAudio() {
  if (ctx || typeof window === "undefined") return;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
    return;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  master = ctx.createGain();
  master.connect(comp).connect(ctx.destination);
  for (const name of ["music", "sfx", "ambient"] as const) {
    const g = ctx.createGain();
    g.connect(master);
    buses[name] = g;
  }
  applyVolumes();
  for (const fn of listeners.splice(0)) fn(ctx);
}

/** Briefly lowers the music (celebrations). */
export function duckMusic(seconds = 2.2) {
  const music = buses.music;
  if (!ctx || !music) return;
  const t = ctx.currentTime;
  const v = useVolumes.getState().music;
  music.gain.cancelScheduledValues(t);
  music.gain.setTargetAtTime(v * 0.25, t, 0.08);
  music.gain.setTargetAtTime(v, t + seconds, 0.4);
}
