// Simulated neighbours: five farms (one per townsperson) rebuilt deterministically every day.
// You can visit, help with up to HELPS_PER_DAY chores each, give gifts and receive one back.

export interface NeighborDef {
  /** Also the NPC id (see npcs.ts). */
  id: string;
  /** Favourite crop, so each farm looks different. */
  crop: string;
  animal: string;
  tree: string;
  building: string;
  decor: readonly string[];
}

export const NEIGHBORS: readonly NeighborDef[] = [
  {
    id: "marigold",
    crop: "sunpop_berry",
    animal: "russet_hen",
    tree: "rosy_apple",
    building: "hen_house",
    decor: ["daisy_bed", "garden_bench", "bloom_barrow"],
  },
  {
    id: "pip",
    crop: "sweetcob_corn",
    animal: "truffle_pig",
    tree: "bellpear",
    building: "gearhouse_garage",
    decor: ["lantern_post", "rain_barrel", "straw_sentinel"],
  },
  {
    id: "barnaby",
    crop: "goldenstalk_wheat",
    animal: "dapple_cow",
    tree: "blushing_peach",
    building: "windgrist_mill",
    decor: ["rain_barrel", "straw_sentinel", "stepping_stones"],
  },
  {
    id: "juniper",
    crop: "lavender_plume",
    animal: "puffwool_sheep",
    tree: "snowdrop_cherry",
    building: "red_barn",
    decor: ["stone_fountain", "bloom_barrow", "daisy_bed"],
  },
  {
    id: "hollis",
    crop: "sunflower_crown",
    animal: "chestnut_horse",
    tree: "sunny_lemon",
    building: "hoofbeat_stable",
    decor: ["garden_gazebo", "lantern_post", "stone_fountain"],
  },
];

export const HELPS_PER_DAY = 5;
/** Friendship points per heart; gifts need at least one heart. */
export const HEART = 5;
export const MAX_HEARTS = 5;

/** What a single help pays you. */
export const helpReward = (level: number) => ({ coins: 20 + level * 3, xp: 3 });

/** Gifts a neighbour can send back, rolled with the farm's hidden randomness. */
export const GIFT_TABLE: ReadonlyArray<{
  weight: number;
  coins?: number;
  fuel?: number;
  materials?: Record<string, number>;
}> = [
  { weight: 35, coins: 250 },
  { weight: 25, materials: { fertilizer_sack: 2 } },
  { weight: 15, coins: 600 },
  { weight: 15, fuel: 10 },
  { weight: 10, materials: { brass_cog: 1 } },
];

export const getNeighbor = (id: string) => NEIGHBORS.find((n) => n.id === id);
