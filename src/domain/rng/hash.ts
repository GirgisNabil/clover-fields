// Deterministic hashing. Visible randomness (like the moment a crop withers) is derived
// from a hash of stable inputs, so every client agrees and replays are exact. Hidden
// outcomes (future drops) use `roll`, which advances a counter stored in the farm state.

export function fmix32(input: number): number {
  let h = input;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** FNV-1a over the parts (numbers as base-36 strings, exact for integers), then fmix32. */
export function hash32(...parts: ReadonlyArray<number | string>): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = typeof part === "number" ? part.toString(36) : part;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 0x1f, 0x01000193);
  }
  return fmix32(h);
}

/** Maps a 32-bit hash to [0, 1). */
export const toUnit = (h: number): number => h / 4294967296;

export function roll(target: { rng: { seed: number; counter: number } }): number {
  const u = toUnit(hash32("roll", target.rng.seed, target.rng.counter));
  target.rng.counter += 1;
  return u;
}
