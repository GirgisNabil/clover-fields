// Balance formulas behind the catalog tables. The tables are hand-authored data;
// balance.test.ts keeps them within rounding of these formulas, so retuning means
// changing a formula here and regenerating the affected numbers.

import { HOUR, MINUTE, XP_PER_CLOVER } from "../constants";
import type { Price } from "./types";

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Net coins per crop cycle after seed and plow, before rounding. */
export function cropNet(growMs: number, unlockLevel: number): number {
  return 14 * (growMs / (2 * MINUTE)) ** 0.42 * (1 + unlockLevel / 40);
}

export function cropSeedCost(growMs: number, unlockLevel: number): number {
  return round5(cropNet(growMs, unlockLevel) / 2 + 5);
}

export function cropSale(growMs: number, unlockLevel: number): number {
  return round5(cropSeedCost(growMs, unlockLevel) + 10 + cropNet(growMs, unlockLevel));
}

export function cropPlantXp(growMs: number): number {
  if (growMs < 1 * HOUR) return 1;
  if (growMs < 8 * HOUR) return 2;
  if (growMs < 24 * HOUR) return 3;
  if (growMs < 48 * HOUR) return 4;
  return 5;
}

/** Harvests needed for the first mastery star; stars 2 and 3 need 3× and 6× that. */
export function cropFirstStar(growMs: number): number {
  return Math.max(10, round5(200 * (growMs / (2 * MINUTE)) ** -0.35));
}

export function producerPayout(kind: "animal" | "tree", cycleMs: number, unlockLevel: number) {
  const k = kind === "animal" ? 12 : 10;
  const value = k * (cycleMs / HOUR) ** 0.55 * (1 + unlockLevel / 40);
  return value < 20 ? Math.round(value) : round5(value);
}

/** Producers pay for themselves in 10 (animals) or 12 (trees) cycles. */
export function producerPrice(kind: "animal" | "tree", payout: number): number {
  return (kind === "animal" ? 10 : 12) * payout;
}

export function xpOnBuy(kind: "decoration" | "producer" | "building", price: Price): number {
  if ("clovers" in price) return price.clovers * XP_PER_CLOVER;
  const divisor = kind === "decoration" ? 40 : kind === "producer" ? 50 : 80;
  return Math.floor(price.coins / divisor);
}

/** Chance a crop harvest drops its bushel (from level 15): longer crops and mastery help. */
export function bushelChance(growMs: number, stars: number, fertilized: boolean): number {
  return Math.min(
    0.4,
    0.03 * (growMs / (2 * MINUTE)) ** 0.3 * (1 + 0.5 * stars) * (fertilized ? 1.5 : 1),
  );
}

/** Crafted goods sell for 30% more than their inputs. */
export const goodSale = (inputsValue: number) => round5(1.3 * inputsValue);
export const craftXp = (inputsValue: number) => Math.ceil(inputsValue / 40);

/** Roaming animals (see rules/animals.ts). */
export const ROAM = {
  /** Each animal visits one tile per window. */
  windowMs: 10 * MINUTE,
  /** Local hours when animals rest at home (no visits, no manure). */
  restFromHour: 20,
  restToHour: 6,
  /** Offline catch-up is capped so a long absence can't snowball. */
  catchUpMs: 48 * HOUR,
  /** How far (in steps) an animal wanders from home. */
  radius: 6,
  wideRadius: 8,
} as const;

/** How many of a home building's animals roam each day; the rest stay inside. */
export const homeRoamers = (tier: 1 | 2 | 3) => 4 + 2 * (tier - 1);

/** Manure: one per crop, never stacks. */
export const MANURE = {
  /** Share of the crop's remaining grow time (at the moment of manuring) that is skipped. */
  growCut: 0.2,
  /** Extra harvest coins. */
  coinBonus: 0.15,
} as const;

export const manuredSale = (sale: number) => Math.round(sale * (1 + MANURE.coinBonus));

/** Chance per daytime visit that an animal leaves manure (small and often for hens, rarer for big animals). */
export const MANURE_CHANCE: Readonly<Record<string, number>> = {
  russet_hen: 0.5,
  puddle_duck: 0.45,
  nanny_goat: 0.35,
  puffwool_sheep: 0.35,
  truffle_pig: 0.35,
  dapple_cow: 0.4,
  meadow_donkey: 0.3,
  chestnut_horse: 0.3,
};

/** Animals like fields: a plot tile is this many times likelier to be visited than grass. */
export const FIELD_PULL = 3;

/** Big strides: these animals wander further from home. */
export const WIDE_ROAMERS: ReadonlySet<string> = new Set(["meadow_donkey", "chestnut_horse"]);

/** Silk moths pollinate crops near their hut. */
export const POLLINATION = { radius: 3, bushelMult: 1.1 } as const;

/** Sale value of raw silk (moths drop one per collect). */
export const SILK_SALE = 40;

/** Chance a harvest/collect/plow turns up a collectible (from the collections feature level). */
export function findChance(source: { kind: string; growMs?: number }): number {
  if (source.kind === "crop") {
    // Longer crops are rarer harvests, so they find more: 4% (2 min) up to 20% (2+ days).
    const t = (source.growMs ?? 2 * MINUTE) / (2 * MINUTE);
    return Math.min(0.2, 0.04 * t ** 0.22);
  }
  if (source.kind === "plow") return 0.02;
  return 0.08;
}

/** Turning in a set again pays more each time, up to 4×. */
export function setReward(baseCoins: number, timesBefore: number) {
  const mult = Math.min(4, 1 + 0.5 * timesBefore);
  return { coins: Math.round(baseCoins * mult), xp: Math.round((baseCoins / 10) * mult) };
}

/** Duplicates traded for one missing piece, by the piece's rarity. */
export const SWAP_COST = { common: 3, uncommon: 3, rare: 6, veryRare: 10 } as const;

/** Ribbon tier rewards: green, bronze, silver, gold. */
export const RIBBON_REWARDS = [
  { coins: 150, xp: 15 },
  { coins: 600, xp: 60 },
  { coins: 2500, xp: 200 },
  { coins: 8000, xp: 500, clovers: 2 },
] as const;
