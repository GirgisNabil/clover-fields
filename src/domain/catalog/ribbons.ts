import type { FarmState } from "../types/state";

// Ribbons: 15 lifetime achievements, each with four tiers (green, bronze, silver, gold).
// Values come from stats counters or simple derived numbers, so old saves earn their backlog.

export interface RibbonDef {
  id: string;
  name: string;
  icon: string;
  /** The goal for the next threshold, e.g. "Harvest 250 crops". */
  goal: (n: number) => string;
  thresholds: readonly [number, number, number, number];
  value: (state: FarmState) => number;
}

export const TIER_NAMES = ["Green", "Bronze", "Silver", "Gold"] as const;

const fmt = (n: number) => n.toLocaleString("en-US");

const stat = (key: string) => (s: FarmState) => s.stats.counters[key] ?? 0;

export const RIBBONS: readonly RibbonDef[] = [
  {
    id: "harvester",
    name: "Harvester",
    icon: "🌾",
    goal: (n) => `Harvest ${fmt(n)}${n === 1 ? " crop" : " crops"}`,
    thresholds: [25, 250, 2500, 25000],
    value: stat("harvest:crop"),
  },
  {
    id: "plowhand",
    name: "Plowhand",
    icon: "⛏️",
    goal: (n) => `Plow ${fmt(n)}${n === 1 ? " plot" : " plots"}`,
    thresholds: [25, 250, 2500, 20000],
    value: stat("plow"),
  },
  {
    id: "sower",
    name: "Sower",
    icon: "🌱",
    goal: (n) => `Plant ${fmt(n)}${n === 1 ? " seed" : " seeds"}`,
    thresholds: [25, 250, 2500, 20000],
    value: stat("plant"),
  },
  {
    id: "rancher",
    name: "Rancher",
    icon: "🐄",
    goal: (n) => `Collect from animals ${fmt(n)}${n === 1 ? " time" : " times"}`,
    thresholds: [10, 100, 1000, 10000],
    value: stat("collect:animal"),
  },
  {
    id: "orchardist",
    name: "Orchardist",
    icon: "🍎",
    goal: (n) => `Collect from trees ${fmt(n)}${n === 1 ? " time" : " times"}`,
    thresholds: [10, 100, 1000, 10000],
    value: stat("collect:tree"),
  },
  {
    id: "tycoon",
    name: "Tycoon",
    icon: "🪙",
    goal: (n) => `Earn ${fmt(n)}${n === 1 ? " coin" : " coins"}`,
    thresholds: [5000, 50000, 500000, 5000000],
    value: stat("coins:earned"),
  },
  {
    id: "green_thumb",
    name: "Green Thumb",
    icon: "⭐",
    goal: (n) => `Earn ${fmt(n)} mastery stars`,
    thresholds: [3, 12, 30, 66],
    value: (s) => Object.values(s.mastery).reduce((sum, m) => sum + (m?.stars ?? 0), 0),
  },
  {
    id: "artisan",
    name: "Artisan",
    icon: "🥖",
    goal: (n) => `Craft ${fmt(n)}${n === 1 ? " good" : " goods"}`,
    thresholds: [5, 50, 300, 1500],
    value: stat("craft:done"),
  },
  {
    id: "driver",
    name: "Driver",
    icon: "🚜",
    goal: (n) => `Work ${fmt(n)}${n === 1 ? " tile with vehicles" : " tiles with vehicles"}`,
    thresholds: [50, 500, 5000, 25000],
    value: stat("vehicle:tiles"),
  },
  {
    id: "builder",
    name: "Builder",
    icon: "🏠",
    goal: (n) => `Build ${fmt(n)}${n === 1 ? " building" : " buildings"}`,
    thresholds: [1, 4, 8, 14],
    value: stat("buy:building"),
  },
  {
    id: "decorator",
    name: "Decorator",
    icon: "🌼",
    goal: (n) => `Place ${fmt(n)}${n === 1 ? " decoration" : " decorations"}`,
    thresholds: [5, 25, 100, 400],
    value: stat("buy:decoration"),
  },
  {
    id: "collector",
    name: "Collector",
    icon: "🏆",
    goal: (n) => `Turn in ${fmt(n)}${n === 1 ? " collection" : " collections"}`,
    thresholds: [1, 5, 15, 40],
    value: (s) => Object.values(s.collections).reduce((sum, c) => sum + c.redeemed, 0),
  },
  {
    id: "landowner",
    name: "Landowner",
    icon: "🗺️",
    goal: (n) => `Expand your farm ${fmt(n)}${n === 1 ? " time" : " times"}`,
    thresholds: [1, 2, 4, 7],
    value: (s) => s.land.expansionIndex,
  },
  {
    id: "fertile_ground",
    name: "Fertile Ground",
    icon: "💩",
    goal: (n) => `Harvest ${fmt(n)} manured crops`,
    thresholds: [10, 100, 1000, 5000],
    value: stat("harvest:manured"),
  },
  {
    id: "rescuer",
    name: "Watchful Eye",
    icon: "👀",
    goal: (n) =>
      `Collect ${fmt(n)}${n === 1 ? " time from animal homes" : " times from animal homes"}`,
    thresholds: [10, 100, 1000, 5000],
    value: stat("harvest:building"),
  },
];

export const getRibbon = (id: string) => RIBBONS.find((r) => r.id === id);

/** How many tiers a value has reached (0–4). */
export const tierFor = (ribbon: RibbonDef, value: number) =>
  ribbon.thresholds.filter((t) => value >= t).length;
