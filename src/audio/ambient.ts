import { audioContext, bus, onAudioReady } from "./engine";

// Ambience: a soft wind bed, birdsong by day and crickets at night.

let wind: { src: AudioBufferSourceNode; filter: BiquadFilterNode } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let night = false;

export function setNight(value: boolean) {
  night = value;
}

function startWind(ctx: AudioContext, out: AudioNode) {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    // Brown-ish noise: gentle and low.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 500;
  filter.Q.value = 0.6;
  const amp = ctx.createGain();
  amp.gain.value = 0.12;
  src.connect(filter).connect(amp).connect(out);
  src.start();
  wind = { src, filter };
}

function chirp(ctx: AudioContext, out: AudioNode) {
  const t = ctx.currentTime;
  if (night) {
    // Cricket: a quick pulsed high tone.
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.frequency.value = 4400 + Math.random() * 200;
      amp.gain.setValueAtTime(0.0001, t + i * 0.06);
      amp.gain.exponentialRampToValueAtTime(0.02, t + i * 0.06 + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.04);
      osc.connect(amp).connect(out);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.05);
    }
    return;
  }
  // Bird: two or three quick upward whistles.
  const notes = 2 + Math.floor(Math.random() * 2);
  const base = 2200 + Math.random() * 1400;
  for (let i = 0; i < notes; i++) {
    const start = t + i * 0.13;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base, start);
    osc.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), start + 0.09);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(0.03, start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
    osc.connect(amp).connect(out);
    osc.start(start);
    osc.stop(start + 0.12);
  }
}

export function startAmbient(): () => void {
  let stopped = false;
  onAudioReady((ctx) => {
    const out = bus("ambient");
    if (!out || stopped) return;
    if (!wind) startWind(ctx, out);
    const loop = () => {
      if (stopped) return;
      const c = audioContext();
      if (c && c.state === "running") {
        chirp(c, out);
        if (wind)
          wind.filter.frequency.setTargetAtTime(380 + Math.random() * 420, c.currentTime, 1.5);
      }
      timer = setTimeout(loop, (night ? 1500 : 4000) + Math.random() * (night ? 2000 : 7000));
    };
    loop();
  });
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
