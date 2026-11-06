import { TROPHIES } from "./collections";
import { CROPS } from "./crops";
import type { DecorationDef, Price } from "./types";

function deco(
  id: string,
  name: string,
  icon: string,
  unlockLevel: number,
  footprint: readonly [number, number],
  price: Price,
  xpOnBuy: number,
  walkable = false,
): DecorationDef {
  return {
    kind: "decoration",
    id,
    name,
    icon,
    unlockLevel,
    footprint,
    price,
    xpOnBuy,
    sellable: true,
    storable: true,
    walkable,
  };
}

// XP on purchase is floor(coins / 40), or 30 per Golden Clover (see balance.ts).
export const SHOP_DECORATIONS: readonly DecorationDef[] = [
  deco("rail_fence", "Rail Fence", "🪵", 1, [1, 1], { coins: 20 }, 0),
  deco("stepping_stones", "Stepping Stones", "🪨", 1, [1, 1], { coins: 30 }, 0, true),
  deco("daisy_bed", "Daisy Bed", "🌼", 1, [1, 1], { coins: 60 }, 1),
  deco("rain_barrel", "Rain Barrel", "🛢️", 2, [1, 1], { coins: 120 }, 3),
  deco("straw_sentinel", "Straw Sentinel", "🧑‍🌾", 3, [1, 1], { coins: 200 }, 5),
  deco("bloom_barrow", "Bloom Barrow", "💐", 4, [1, 1], { coins: 250 }, 6),
  deco("moonlit_lantern_tree", "Moonlit Lantern Tree", "🎐", 5, [1, 1], { clovers: 3 }, 90),
  deco("lantern_post", "Lantern Post", "🏮", 6, [1, 1], { coins: 350 }, 8),
  deco("garden_bench", "Garden Bench", "🪑", 7, [2, 1], { coins: 450 }, 11),
  deco("clover_statue", "Golden Clover Statue", "🏆", 8, [2, 2], { clovers: 8 }, 240),
  deco("wishing_well", "Wishing Well", "🪣", 9, [2, 2], { coins: 900 }, 22),
  deco("topiary_swan", "Topiary Swan", "🦢", 11, [1, 1], { coins: 1200 }, 30),
  deco("little_windmill", "Little Windmill", "🌬️", 13, [2, 2], { coins: 2500 }, 62),
  deco("stone_fountain", "Stone Fountain", "⛲", 15, [2, 2], { coins: 3200 }, 80),
  deco("garden_gazebo", "Garden Gazebo", "🛖", 19, [3, 3], { coins: 6000 }, 150),
  deco("rainbow_arch", "Rainbow Arch", "🌈", 25, [3, 1], { coins: 12000 }, 300),
  deco("hedge_arch", "Hedge Arch", "🌿", 27, [2, 1], { coins: 15000 }, 375),
  deco("stargazer_scope", "Stargazer Telescope", "🔭", 31, [1, 1], { coins: 20000 }, 500),
  deco("weathervane", "Copper Weathervane", "🧭", 34, [1, 1], { coins: 26000 }, 650),
  deco("bandstand", "Bandstand", "🎺", 38, [3, 3], { coins: 34000 }, 850),
  deco("balloon_mooring", "Balloon Mooring", "🎈", 42, [2, 2], { coins: 45000 }, 1125),
  deco("glass_conservatory", "Glass Conservatory", "🏛️", 47, [4, 3], { coins: 60000 }, 1500),
  deco("stone_bridge", "Stone Bridge", "🌉", 37, [3, 2], { coins: 40000 }, 1000),
  deco("horse_statue", "Gallant Horse Statue", "🐎", 43, [2, 2], { coins: 52000 }, 1300),
  deco("market_stall", "Market Stall", "🏪", 46, [2, 2], { coins: 56000 }, 1400),
  deco("garden_cottage", "Garden Cottage", "🏡", 49, [3, 3], { coins: 70000 }, 1750),
];

/** A mastery sign for every crop, granted at 3 stars. */
export const MASTERY_SIGNS: readonly DecorationDef[] = CROPS.map((crop) => ({
  kind: "decoration",
  id: `sign_${crop.id}`,
  name: `${crop.name} Mastery Sign`,
  icon: "🪧",
  unlockLevel: 1,
  footprint: [1, 1],
  price: null,
  xpOnBuy: 0,
  sellable: true,
  storable: true,
  walkable: false,
  rewardOnly: true,
  masteryOf: crop.id,
}));

export const REWARD_DECORATIONS: readonly DecorationDef[] = [
  {
    kind: "decoration",
    id: "monarch_throne",
    name: "Clover Monarch Throne",
    icon: "👑",
    unlockLevel: 50,
    footprint: [2, 2],
    price: null,
    xpOnBuy: 0,
    sellable: true,
    storable: true,
    walkable: false,
    rewardOnly: true,
  },
];

export const DECORATIONS: readonly DecorationDef[] = [
  ...SHOP_DECORATIONS,
  ...MASTERY_SIGNS,
  ...REWARD_DECORATIONS,
  ...TROPHIES,
];
