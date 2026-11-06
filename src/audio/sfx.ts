// Tiny WebAudio synth for game sounds: original, procedural, no audio files to license.

import { audioContext, bus } from "./engine";

export { unlockAudio } from "./engine";

const lastPlayed = new Map<string, number>();

interface Note {
  freq: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
}

function play(name: string, notes: Note[], minGapMs = 60) {
  const ctx = audioContext();
  const out = bus("sfx");
  if (!ctx || !out) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < minGapMs) return;
  lastPlayed.set(name, now);
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime;
  const jitter = 0.96 + Math.random() * 0.08;
  for (const note of notes) {
    const start = t0 + (note.at ?? 0);
    const dur = note.dur ?? 0.12;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = note.type ?? "triangle";
    osc.frequency.setValueAtTime(note.freq * jitter, start);
    if (note.slide) osc.frequency.exponentialRampToValueAtTime(note.slide * jitter, start + dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(note.gain ?? 0.12, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}

export const sfx = {
  plow: () => play("plow", [{ freq: 140, slide: 70, dur: 0.12, type: "sawtooth", gain: 0.05 }]),
  plant: () => play("plant", [{ freq: 520, slide: 780, dur: 0.09, gain: 0.08 }]),
  coin: () =>
    play("coin", [
      { freq: 988, dur: 0.07, type: "square", gain: 0.05 },
      { freq: 1319, at: 0.06, dur: 0.16, type: "square", gain: 0.05 },
    ]),
  collect: () =>
    play("collect", [
      { freq: 660, dur: 0.08 },
      { freq: 880, at: 0.07, dur: 0.12 },
    ]),
  place: () => play("place", [{ freq: 300, slide: 220, dur: 0.1, type: "sine", gain: 0.12 }]),
  error: () =>
    play("error", [{ freq: 220, slide: 160, dur: 0.18, type: "square", gain: 0.04 }], 300),
  engine: () =>
    play(
      "engine",
      [
        { freq: 70, slide: 110, dur: 0.5, type: "sawtooth", gain: 0.04 },
        { freq: 140, slide: 90, at: 0.45, dur: 0.4, type: "sawtooth", gain: 0.03 },
      ],
      400,
    ),
  click: () => play("click", [{ freq: 900, dur: 0.03, type: "sine", gain: 0.05 }]),
  levelUp: () =>
    play(
      "levelUp",
      [523, 659, 784, 1047].map((freq, i) => ({
        freq,
        at: i * 0.11,
        dur: 0.22,
        type: "triangle" as const,
      })),
      500,
    ),
  star: () =>
    play(
      "star",
      [784, 988, 1175].map((freq, i) => ({ freq, at: i * 0.09, dur: 0.18, type: "sine" as const })),
      500,
    ),
};
