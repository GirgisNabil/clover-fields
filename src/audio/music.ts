import { audioContext, bus, onAudioReady } from "./engine";

// Procedural pastoral music: a lookahead scheduler plays a four-chord loop with a soft pad, a
// bass, a plucked melody that wanders over a pentatonic scale, and a light shaker. Each mood
// changes key, tempo and timbre. Original and generated live, so there is nothing to license.

export type MusicMood = "farm" | "visit" | "autumn" | "winter" | "spring" | "summer";

interface Style {
  root: number; // MIDI note of the key
  bpm: number;
  /** Chord roots in scale degrees (semitones from the key) and whether each is minor. */
  chords: Array<[number, boolean]>;
  lead: OscillatorType;
  leadOctave: number;
  density: number; // chance a melody step plays
  shaker: boolean;
  bass: boolean;
}

const STYLES: Record<MusicMood, Style> = {
  farm: {
    root: 60,
    bpm: 84,
    chords: [
      [0, false],
      [7, false],
      [9, true],
      [5, false],
    ],
    lead: "triangle",
    leadOctave: 1,
    density: 0.55,
    shaker: true,
    bass: true,
  },
  visit: {
    root: 62,
    bpm: 88,
    chords: [
      [0, false],
      [5, false],
      [7, false],
      [5, false],
    ],
    lead: "sine",
    leadOctave: 1,
    density: 0.45,
    shaker: true,
    bass: false,
  },
  autumn: {
    root: 57,
    bpm: 76,
    chords: [
      [0, true],
      [10, false],
      [8, false],
      [7, false],
    ],
    lead: "triangle",
    leadOctave: 1,
    density: 0.5,
    shaker: false,
    bass: true,
  },
  winter: {
    root: 62,
    bpm: 70,
    chords: [
      [0, false],
      [9, true],
      [5, false],
      [7, false],
    ],
    lead: "sine",
    leadOctave: 2,
    density: 0.35,
    shaker: false,
    bass: true,
  },
  spring: {
    root: 65,
    bpm: 92,
    chords: [
      [0, false],
      [5, false],
      [9, true],
      [7, false],
    ],
    lead: "sine",
    leadOctave: 1,
    density: 0.6,
    shaker: true,
    bass: true,
  },
  summer: {
    root: 67,
    bpm: 100,
    chords: [
      [0, false],
      [7, false],
      [5, false],
      [7, false],
    ],
    lead: "square",
    leadOctave: 0,
    density: 0.6,
    shaker: true,
    bass: true,
  },
};

const PENTATONIC = [0, 2, 4, 7, 9];
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

let mood: MusicMood = "farm";
let nextNoteTime = 0;
let step = 0;
let melody = 2;
let timer: ReturnType<typeof setInterval> | null = null;

export function setMusicMood(next: MusicMood) {
  mood = next;
}

function voice(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  attack = 0.02,
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = type === "square" ? 1800 : 3200;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(lp).connect(amp).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

let noise: AudioBuffer | null = null;
function shaker(ctx: AudioContext, out: AudioNode, start: number, gain: number) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
  src.connect(hp).connect(amp).connect(out);
  src.start(start);
}

/** Schedules every eighth note that falls within the next lookahead window. */
function schedule() {
  const ctx = audioContext();
  const out = bus("music");
  if (!ctx || !out || ctx.state !== "running") return;
  const style = STYLES[mood];
  const eighth = 60 / style.bpm / 2;
  if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + 0.05;
  while (nextNoteTime < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8) % style.chords.length;
    const beat = step % 8;
    const [degree, minor] = style.chords[bar] ?? [0, false];
    const root = style.root + degree;
    const t = nextNoteTime;
    if (beat === 0) {
      // Soft pad: the chord's triad, held for the bar.
      for (const interval of [0, minor ? 3 : 4, 7]) {
        voice(ctx, out, midiHz(root + interval), t, eighth * 8.2, "sine", 0.035, 0.4);
      }
    }
    if (style.bass && (beat === 0 || beat === 4)) {
      voice(ctx, out, midiHz(root - 24), t, eighth * 3, "sine", 0.08, 0.02);
    }
    if (Math.random() < style.density) {
      // The melody wanders up or down the pentatonic scale, leaning toward the chord root.
      melody = Math.max(0, Math.min(9, melody + Math.round((Math.random() - 0.5) * 3)));
      const octave = Math.floor(melody / 5);
      const note = style.root + 12 * style.leadOctave + (PENTATONIC[melody % 5] ?? 0) + 12 * octave;
      voice(ctx, out, midiHz(note), t, eighth * (Math.random() < 0.3 ? 2 : 1.2), style.lead, 0.045);
    }
    if (style.shaker && beat % 2 === 1) shaker(ctx, out, t, 0.02);
    nextNoteTime += eighth;
    step++;
  }
}

/** Starts the scheduler once audio is unlocked. Returns a stop function. */
export function startMusic(): () => void {
  onAudioReady(() => {
    if (!timer) timer = setInterval(schedule, 100);
  });
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
