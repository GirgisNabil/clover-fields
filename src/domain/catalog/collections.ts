import type { CropShape, DecorationDef, MaterialDef, Rarity } from "./types";

// Collections: 8 sets of 6 keepsakes found while farming. Each set comes from one kind of work.
// A find uses the action's existing "find" roll (see rules/drops.ts), so no extra randomness.

export type FindSource =
  | { kind: "crop"; shape: CropShape; growMs: number }
  | { kind: "animal" }
  | { kind: "tree" }
  | { kind: "plow" }
  | { kind: "craft" };

export interface CollectionSet {
  id: string;
  name: string;
  icon: string;
  /** Shown on undiscovered slots: "Found by …". */
  hint: string;
  /** Coins for the first turn-in (later turn-ins pay more, see setReward). */
  baseCoins: number;
  matches: (source: FindSource) => boolean;
  items: ReadonlyArray<{ id: string; name: string; icon: string }>;
}

/** Item rarity by slot: two common, two uncommon, one rare, one very rare. */
export const SLOT_RARITY: readonly Rarity[] = [
  "common",
  "common",
  "uncommon",
  "uncommon",
  "rare",
  "veryRare",
];

/** Relative odds of each slot within a set when something is found. */
export const SLOT_WEIGHT: readonly number[] = [30, 30, 14, 14, 8, 4];

const crop =
  (...shapes: CropShape[]) =>
  (s: FindSource) =>
    s.kind === "crop" && shapes.includes(s.shape);

const set = (
  id: string,
  name: string,
  icon: string,
  hint: string,
  baseCoins: number,
  matches: (s: FindSource) => boolean,
  items: Array<[string, string]>,
): CollectionSet => ({
  id,
  name,
  icon,
  hint,
  baseCoins,
  matches,
  items: items.map(([itemName, itemIcon], i) => ({
    id: `col_${id}_${i + 1}`,
    name: itemName,
    icon: itemIcon,
  })),
});

export const COLLECTIONS: readonly CollectionSet[] = [
  set(
    "root_cellar",
    "Root Cellar",
    "🥕",
    "harvesting root and leafy crops",
    400,
    crop("root", "leafy", "spiky"),
    [
      ["Twisted Root", "🫚"],
      ["Pebble Charm", "🪨"],
      ["Old Trowel", "🔧"],
      ["Turnip Token", "🪙"],
      ["Truffle Map", "🗺️"],
      ["Golden Carrot", "🥕"],
    ],
  ),
  set(
    "berry_basket",
    "Berry Basket",
    "🫐",
    "harvesting berries, tomatoes, melons and pumpkins",
    500,
    crop("bush", "vine"),
    [
      ["Berry Leaf", "🍃"],
      ["Wicker Scrap", "🧺"],
      ["Jam Spoon", "🥄"],
      ["Ladybug Pin", "🐞"],
      ["Ruby Thimble", "💍"],
      ["Starfruit Gem", "💎"],
    ],
  ),
  set(
    "harvest_moon",
    "Harvest Moon",
    "🌾",
    "harvesting grains, corn, peas and peppers",
    600,
    crop("grain", "stalk", "pod", "sprig"),
    [
      ["Straw Twist", "🌾"],
      ["Seed Pouch", "👝"],
      ["Scarecrow Button", "🔘"],
      ["Weather Feather", "🪶"],
      ["Brass Bell", "🛎️"],
      ["Moonlit Grain", "🌙"],
    ],
  ),
  set(
    "petal_parade",
    "Petal Parade",
    "🌸",
    "harvesting flowers",
    700,
    crop("flower", "tallflower"),
    [
      ["Pressed Petal", "🌸"],
      ["Garden Ribbon", "🎗️"],
      ["Bee Badge", "🐝"],
      ["Dew Drop", "💧"],
      ["Butterfly Brooch", "🦋"],
      ["Rainbow Bloom", "🌈"],
    ],
  ),
  set(
    "barnyard_keepsakes",
    "Barnyard Keepsakes",
    "🐄",
    "collecting from animals",
    800,
    (s) => s.kind === "animal",
    [
      ["Fleece Curl", "☁️"],
      ["Cowbell", "🔔"],
      ["Feather Tuft", "🪶"],
      ["Lucky Horseshoe", "🧲"],
      ["Golden Egg", "🥚"],
      ["Prize Rosette", "🏵️"],
    ],
  ),
  set(
    "orchard_whispers",
    "Orchard Whispers",
    "🍎",
    "collecting from fruit trees",
    900,
    (s) => s.kind === "tree",
    [
      ["Bark Chip", "🪵"],
      ["Bird Nest", "🪺"],
      ["Pruning Shears", "✂️"],
      ["Honeycomb", "🍯"],
      ["Hidden Acorn", "🌰"],
      ["Silver Apple", "🍏"],
    ],
  ),
  set("plowmans_finds", "Plowman's Finds", "⛏️", "plowing", 600, (s) => s.kind === "plow", [
    ["Arrowhead", "🔺"],
    ["Clay Shard", "🏺"],
    ["Rusty Key", "🗝️"],
    ["Fossil Shell", "🐚"],
    ["Old Compass", "🧭"],
    ["Lost Crown", "👑"],
  ]),
  set(
    "artisans_odds",
    "Artisan's Odds",
    "🧑‍🍳",
    "collecting crafted goods",
    1000,
    (s) => s.kind === "craft",
    [
      ["Flour Tag", "🏷️"],
      ["Wooden Ladle", "🥢"],
      ["Copper Kettle", "🫖"],
      ["Recipe Card", "📜"],
      ["Silver Whisk", "🥄"],
      ["Golden Rolling Pin", "🪄"],
    ],
  ),
];

/** Collectible items are materials (no shed space), capped per item. */
export const COLLECTIBLES: readonly MaterialDef[] = COLLECTIONS.flatMap((s) =>
  s.items.map((item, i) => ({
    kind: "material" as const,
    mkind: "collectible" as const,
    id: item.id,
    name: item.name,
    icon: item.icon,
    unlockLevel: 1,
    cap: 99,
    setId: s.id,
    rarity: SLOT_RARITY[i] ?? "common",
  })),
);

/** A trophy for the first turn-in of each set. */
export const TROPHIES: readonly DecorationDef[] = COLLECTIONS.map((s) => ({
  kind: "decoration",
  id: `trophy_${s.id}`,
  name: `${s.name} Trophy`,
  icon: "🏆",
  unlockLevel: 1,
  footprint: [1, 1],
  price: null,
  xpOnBuy: 0,
  sellable: true,
  storable: true,
  walkable: false,
  rewardOnly: true,
}));

export const getSet = (id: string) => COLLECTIONS.find((s) => s.id === id);
export const setOf = (source: FindSource) => COLLECTIONS.find((s) => s.matches(source));
