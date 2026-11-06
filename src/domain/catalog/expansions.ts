import type { ExpansionDef } from "./types";

/** Index 0 is the starting farm; each later entry is bought in order. Land grows toward +x/+y. */
export const EXPANSIONS: readonly ExpansionDef[] = [
  { index: 0, size: 12, level: 1, neighbors: 0, price: { coins: 0 }, alt: { clovers: 0 } },
  { index: 1, size: 14, level: 4, neighbors: 0, price: { coins: 2500 }, alt: { clovers: 4 } },
  { index: 2, size: 16, level: 8, neighbors: 0, price: { coins: 8000 }, alt: { clovers: 8 } },
  { index: 3, size: 18, level: 12, neighbors: 0, price: { coins: 20000 }, alt: { clovers: 12 } },
  { index: 4, size: 20, level: 16, neighbors: 0, price: { coins: 45000 }, alt: { clovers: 16 } },
  { index: 5, size: 22, level: 22, neighbors: 0, price: { coins: 90000 }, alt: { clovers: 22 } },
  { index: 6, size: 24, level: 28, neighbors: 0, price: { coins: 180000 }, alt: { clovers: 28 } },
  { index: 7, size: 26, level: 35, neighbors: 0, price: { coins: 400000 }, alt: { clovers: 36 } },
];

export const MAX_FARM_SIZE = 26;
