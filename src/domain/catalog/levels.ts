import { MAX_LEVEL } from "../constants";
import type { FeatureId } from "./types";

/** Rounds to a "nice" number: 5s under 100, 10s under 1k, 50s under 10k, else 100s. */
function nice(n: number): number {
  const step = n < 100 ? 5 : n < 1_000 ? 10 : n < 10_000 ? 50 : 100;
  return Math.round(n / step) * step;
}

/** Cumulative XP needed to reach `level`. */
export function cumXpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return nice(5 * n ** 2.5 + 10 * n);
}

/** LEVEL_XP[level] = cumulative XP to reach that level (index 0 unused). */
export const LEVEL_XP: readonly number[] = Array.from({ length: MAX_LEVEL + 1 }, (_, level) =>
  cumXpForLevel(level),
);

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= (LEVEL_XP[level + 1] ?? Number.POSITIVE_INFINITY)) level++;
  return level;
}

export function levelUpCoins(level: number): number {
  return Math.round((25 * level ** 1.5) / 50) * 50;
}

export function levelUpClovers(level: number): number {
  return level % 5 === 0 ? 2 : 1;
}

const TITLES = [
  "Seedling",
  "Sprout Tender",
  "Furrow Hand",
  "Field Keeper",
  "Harvest Warden",
  "Orchard Steward",
  "Clover Squire",
  "Prairie Sage",
  "Golden Grower",
  "Verdant Legend",
] as const;

export function titleFor(level: number): string {
  if (level >= MAX_LEVEL) return "Clover Monarch";
  if (level < 5) return TITLES[0];
  return TITLES[Math.min(TITLES.length - 1, Math.floor(level / 5))] ?? TITLES[0];
}

export const FEATURE_LEVEL: Readonly<Record<FeatureId, number>> = {
  animals: 2,
  trees: 3,
  store: 4,
  sell: 5,
  buildings: 6,
  quests: 1,
  ribbons: 2,
  daily: 3,
  neighbors: 4,
  events: 5,
  collections: 7,
  vehicles: 12,
  crafting: 15,
  garage: 18,
};

export const FEATURE_NAMES: Readonly<Record<FeatureId, string>> = {
  animals: "Animals in the Market",
  trees: "Fruit trees in the Market",
  store: "Store items in the Tool Shed",
  sell: "Sell placed items",
  buildings: "Buildings in the Market",
  quests: "Quests",
  ribbons: "Ribbons",
  daily: "Daily bonus",
  neighbors: "Neighbors to visit",
  events: "Seasonal events",
  collections: "Collections",
  vehicles: "Farm vehicles",
  crafting: "Crafting",
  garage: "Garage",
};
