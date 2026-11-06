import { DAY, HOUR } from "../constants";
import { cropPlantXp, cropSale, cropSeedCost, producerPayout } from "./balance";
import type { CropDef, DecorationDef, ProducerDef } from "./types";

// Seasonal events: yearly windows (UTC). While one runs, harvests and collects earn its tokens,
// its crop can be planted, and its shop sells limited decorations and an animal. Leftover tokens
// turn into coins (5 each) once the event ends.

export type Mood = "autumn" | "winter" | "spring" | "summer";

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  token: { name: string; icon: string };
  /** First day (UTC) of the yearly window, and its length in days. */
  start: { month: number; day: number };
  days: number;
  mood: Mood;
  crop: string;
  shop: ReadonlyArray<{ defId: string; tokens: number }>;
  blurb: string;
}

export const TOKEN_COIN_VALUE = 5;
/** Event crops earn this many times their plant XP in tokens. */
export const EVENT_CROP_TOKENS = 3;

export const EVENTS: readonly EventDef[] = [
  {
    id: "lantern_fair",
    name: "Lantern Harvest Fair",
    icon: "🏮",
    token: { name: "Lantern Tokens", icon: "🏮" },
    start: { month: 10, day: 25 },
    days: 21,
    mood: "autumn",
    crop: "lantern_gourd",
    shop: [
      { defId: "harvest_haystack", tokens: 40 },
      { defId: "jack_sentinel", tokens: 60 },
      { defId: "lantern_string", tokens: 90 },
      { defId: "lantern_hen", tokens: 150 },
    ],
    blurb: "The valley lights its lanterns for the harvest. Grow glowing gourds and decorate!",
  },
  {
    id: "frostberry_festival",
    name: "Frostberry Festival",
    icon: "❄️",
    token: { name: "Snowflakes", icon: "❄️" },
    start: { month: 12, day: 15 },
    days: 21,
    mood: "winter",
    crop: "frostberry",
    shop: [
      { defId: "frosted_fir", tokens: 40 },
      { defId: "snow_lantern", tokens: 70 },
      { defId: "frost_fountain", tokens: 140 },
    ],
    blurb: "Snow on the fields and frostberries on the bushes. Wrap up warm!",
  },
  {
    id: "blossom_week",
    name: "Blossom Week",
    icon: "🌸",
    token: { name: "Petals", icon: "🌸" },
    start: { month: 4, day: 1 },
    days: 14,
    mood: "spring",
    crop: "petalbloom",
    shop: [
      { defId: "blossom_bench", tokens: 40 },
      { defId: "petal_well", tokens: 90 },
      { defId: "blossom_gazebo", tokens: 150 },
    ],
    blurb: "Petals drift over the valley. Plant petalblooms and celebrate spring.",
  },
  {
    id: "midsummer_sunfest",
    name: "Midsummer Sunfest",
    icon: "☀️",
    token: { name: "Sunbeams", icon: "☀️" },
    start: { month: 6, day: 18 },
    days: 14,
    mood: "summer",
    crop: "sunmelon",
    shop: [
      { defId: "sun_barrel", tokens: 40 },
      { defId: "sun_windmill", tokens: 100 },
      { defId: "sun_statue_fountain", tokens: 150 },
    ],
    blurb: "Long golden days. Grow sunmelons and enjoy the summer fair.",
  },
];

const eventCrop = (
  id: string,
  name: string,
  icon: string,
  event: string,
  growMs: number,
  level: number,
  look: CropDef["look"],
): CropDef => ({
  kind: "crop",
  id,
  name,
  icon,
  unlockLevel: level,
  event,
  growMs,
  seedCost: cropSeedCost(growMs, level),
  sale: cropSale(growMs, level),
  plantXp: cropPlantXp(growMs),
  // Event crops have no mastery track.
  mastery: [1e9, 1e9, 1e9],
  look,
});

export const EVENT_CROPS: readonly CropDef[] = [
  eventCrop("lantern_gourd", "Lantern Gourds", "🎃", "lantern_fair", 4 * HOUR, 5, {
    shape: "vine",
    color: "#4f8f2f",
    accent: "#ff8a1f",
  }),
  eventCrop("frostberry", "Frostberries", "🫐", "frostberry_festival", 3 * HOUR, 5, {
    shape: "bush",
    color: "#3f7a5c",
    accent: "#9fdcff",
  }),
  eventCrop("petalbloom", "Petalblooms", "🌸", "blossom_week", 2 * HOUR, 5, {
    shape: "flower",
    color: "#4c9a34",
    accent: "#ffc4dd",
  }),
  eventCrop("sunmelon", "Sunmelons", "🍈", "midsummer_sunfest", 6 * HOUR, 5, {
    shape: "vine",
    color: "#5f9e3a",
    accent: "#ffd84a",
  }),
];

const eventDecor = (
  id: string,
  name: string,
  icon: string,
  event: string,
  footprint: readonly [number, number],
  xp: number,
): DecorationDef => ({
  kind: "decoration",
  id,
  name,
  icon,
  unlockLevel: 1,
  event,
  footprint,
  price: null,
  xpOnBuy: xp,
  sellable: true,
  storable: true,
  walkable: false,
  rewardOnly: true,
});

export const EVENT_DECORATIONS: readonly DecorationDef[] = [
  eventDecor("harvest_haystack", "Harvest Haystack", "🌾", "lantern_fair", [2, 1], 20),
  eventDecor("jack_sentinel", "Jack-o'-Sentinel", "🎃", "lantern_fair", [1, 1], 30),
  eventDecor("lantern_string", "Lantern String", "🏮", "lantern_fair", [2, 1], 45),
  eventDecor("frosted_fir", "Frosted Fir", "🌲", "frostberry_festival", [1, 1], 20),
  eventDecor("snow_lantern", "Snow Lantern", "🕯️", "frostberry_festival", [1, 1], 35),
  eventDecor("frost_fountain", "Frost Fountain", "⛲", "frostberry_festival", [2, 2], 70),
  eventDecor("blossom_bench", "Blossom Bench", "🪑", "blossom_week", [2, 1], 20),
  eventDecor("petal_well", "Petal Well", "🪣", "blossom_week", [2, 2], 45),
  eventDecor("blossom_gazebo", "Blossom Gazebo", "🛖", "blossom_week", [3, 3], 75),
  eventDecor("sun_barrel", "Sun Barrel", "🛢️", "midsummer_sunfest", [1, 1], 20),
  eventDecor("sun_windmill", "Sunny Windmill", "🌬️", "midsummer_sunfest", [2, 2], 50),
  eventDecor("sun_statue_fountain", "Sunfest Fountain", "⛲", "midsummer_sunfest", [2, 2], 75),
];

export const EVENT_ANIMALS: readonly ProducerDef[] = [
  {
    kind: "animal",
    id: "lantern_hen",
    name: "Lantern Hen",
    icon: "🐓",
    unlockLevel: 1,
    event: "lantern_fair",
    footprint: [1, 1],
    price: null,
    xpOnBuy: 30,
    sellable: true,
    storable: true,
    walkable: false,
    cycleMs: 4 * HOUR,
    payout: Math.round(producerPayout("animal", 4 * HOUR, 20)),
    product: { name: "Glowing Eggs", icon: "🥚" },
    housing: "poultry",
  },
];

export const getEvent = (id: string) => EVENTS.find((e) => e.id === id);

/** The UTC window of an event in a given edition (the year it starts). */
export function eventWindow(def: EventDef, edition: number) {
  const start = Date.UTC(edition, def.start.month - 1, def.start.day);
  return { start, end: start + def.days * DAY };
}
