// Plants (crops and fruit trees) come from two CC0 Quaternius packs. Each source file holds one
// plant at one growth stage, colored with flat materials. The build bakes them into one GLB
// (public/models/plants.glb) of single-primitive, vertex-colored meshes, one per *variant* below,
// which the game instances directly.
//
// The GLBs are fetched from a public mirror of the packs pinned to a commit (quaternius.com only
// offers zip downloads); the licence is confirmed on each pack's page.

const MIRROR =
  "https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/c664c6f231d3dd522b38ba52fc39ec33028624e2/public/glb";

export interface PlantPack {
  dir: string;
  title: string;
  page: string;
  files: readonly string[];
}

const stages = (name: string, extra: string[] = []) => [
  `${name}_1`,
  `${name}_2`,
  `${name}_3`,
  `${name}_4`,
  ...extra,
];

export const PLANT_PACKS: readonly PlantPack[] = [
  {
    dir: "crops_pack",
    title: "Ultimate Crops Pack",
    page: "https://quaternius.com/packs/ultimatecrops.html",
    files: [
      ...stages("Wheat"),
      ...stages("Corn"),
      ...stages("Carrot"),
      ...stages("Tomato"),
      ...stages("Pumpkin"),
      ...stages("Watermelon"),
      ...stages("Lettuce"),
      ...stages("BushBerries"),
      ...stages("Beet"),
      ...stages("Flower"),
      ...stages("Rice"),
      ...stages("Apple", ["Apple_Harvested"]),
      ...stages("Orange", ["Orange_Harvested"]),
      ...stages("PalmTree", ["PalmTree_Harvested"]),
      "Orange_Crop",
    ],
  },
  {
    dir: "nature_pack",
    title: "Ultimate Nature Pack",
    page: "https://quaternius.com/packs/ultimatenature.html",
    files: ["Lilypad", "Plant_2"],
  },
];

export const plantUrl = (pack: PlantPack, file: string) => `${MIRROR}/${pack.dir}/${file}.glb`;

/**
 * A baked mesh: a source file with some materials recolored (sRGB hex, matched by material name
 * before any ".001" suffix). Materials listed in `drop` are removed, e.g. fruit for a bare tree.
 */
export interface PlantVariant {
  from: string;
  recolor?: Readonly<Record<string, string>>;
  drop?: readonly string[];
}

/** One variant per stage file, recolored. */
function staged(prefix: string, from: string, recolor: Record<string, string>) {
  const out: Record<string, PlantVariant> = {};
  for (let i = 1; i <= 4; i++) out[`${prefix}_${i}`] = { from: `${from}_${i}`, recolor };
  return out;
}

// Brighter greens than the pack's defaults read better from the high iso camera.
const LEAF = { Green: "#5f9e3a", DarkGreen: "#3f7a2c", DarkGreen2: "#3f7a2c" };
const TREE = { Wood: "#8a5a36", Green_Tree: "#5fa83e", DarkGreen_Tree: "#3f8530" };
const BLOSSOM = { ...TREE, Green_Tree: "#6aae45" };
const OLIVE = { ...TREE, Green_Tree: "#9ab88a", DarkGreen_Tree: "#7a9a6c" };
const PALM = { Wood: "#a77b4f", Green_Tree: "#5fae45", DarkGreen_Tree: "#3f8a34" };

export const PLANT_VARIANTS: Readonly<Record<string, PlantVariant>> = {
  ...staged("Wheat", "Wheat", { ...LEAF, Yellow: "#e8c45a" }),
  ...staged("Corn", "Corn", { ...LEAF, Yellow: "#f2cf4a" }),
  ...staged("Carrot", "Carrot", { ...LEAF, LightOrange: "#ef8a2e" }),
  ...staged("Tomato", "Tomato", { ...LEAF, Red: "#e2382b" }),
  ...staged("Pepper", "Tomato", { ...LEAF, Red: "#ff4a1c" }),
  ...staged("Eggplant", "Tomato", { ...LEAF, Red: "#6a3496" }),
  ...staged("Pea", "Tomato", { ...LEAF, Red: "#9bd85a" }),
  ...staged("Pumpkin", "Pumpkin", { ...LEAF, Orange: "#f08a24" }),
  ...staged("Melon", "Watermelon", { ...LEAF }),
  ...staged("Cabbage", "Lettuce", { DarkGreen: "#9fd0a4" }),
  ...staged("Lettuce", "Lettuce", { DarkGreen: "#6cb848" }),
  ...staged("Strawberry", "BushBerries", { Green_Bush: "#4f9a3a", Berry: "#ef3b46" }),
  ...staged("Blueberry", "BushBerries", { Green_Bush: "#3f8a44", Berry: "#4867d8" }),
  ...staged("Grape", "BushBerries", { Green_Bush: "#5d9a3a", Berry: "#7a3fb0" }),
  ...staged("Potato", "Beet", { DarkGreen: "#5d9a3a", DarkRed: "#c9a46a" }),
  ...staged("Garlic", "Beet", { DarkGreen: "#9cc46a", DarkRed: "#f2e6c2" }),
  ...staged("Clover", "Flower", { DarkGreen2: "#4caf3e", Cyan: "#f5c3dc" }),
  ...staged("Sunflower", "Flower", { DarkGreen2: "#4c8a2c", Cyan: "#ffc928" }),
  ...staged("Rose", "Flower", { DarkGreen2: "#3f7a2c", Cyan: "#e0352b" }),
  ...staged("TulipPink", "Flower", { DarkGreen2: "#4c9a34", Cyan: "#ff6fae" }),
  ...staged("TulipGold", "Flower", { DarkGreen2: "#4c9a34", Cyan: "#ffd23f" }),
  ...staged("TulipViolet", "Flower", { DarkGreen2: "#4c9a34", Cyan: "#b56cff" }),
  ...staged("Lavender", "Rice", { Green: "#6f9a52", LightGreen: "#9a7fe0" }),
  // Late-game crops
  ...staged("Radish", "Beet", { DarkGreen: "#5d9a3a", DarkRed: "#e2405a" }),
  ...staged("Silverleaf", "Lettuce", { DarkGreen: "#b9d6c0" }),
  ...staged("CinnamonCorn", "Corn", { ...LEAF, Yellow: "#c0552c" }),
  ...staged("StarSquash", "Pumpkin", { ...LEAF, Orange: "#fff1b8" }),
  ...staged("Cocoa", "Tomato", { ...LEAF, Red: "#8a5a2a" }),
  ...staged("GlimmerLily", "Flower", { DarkGreen2: "#4c9a34", Cyan: "#8fd3ff" }),
  ...staged("RoyalRice", "Rice", { Green: "#6f9a52", LightGreen: "#f2cf4a" }),
  ...staged("DragonGourd", "Watermelon", {
    Green: "#a8322a",
    DarkGreen: "#3f7a2c",
    DarkGreen2: "#5f1a16",
  }),
  // Seasonal event crops
  ...staged("LanternGourd", "Pumpkin", { ...LEAF, Orange: "#ff8a1f" }),
  ...staged("Frostberry", "BushBerries", { Green_Bush: "#3f7a6c", Berry: "#9fdcff" }),
  ...staged("Petalbloom", "Flower", { DarkGreen2: "#4c9a34", Cyan: "#ffc4dd" }),
  ...staged("Sunmelon", "Watermelon", {
    Green: "#9ab84a",
    DarkGreen: "#5f8f2c",
    DarkGreen2: "#d9c23a",
  }),
  ...staged("PalmTree", "PalmTree", PALM),
  Lilypad: { from: "Lilypad", recolor: { Green: "#4c9a40", Pink: "#f6b3d4" } },
  PineappleFruit: { from: "Orange_Crop", recolor: { Orange: "#e6b22c" } },
  Withered: { from: "Plant_2", recolor: { Wood: "#7a5a36", Leaves: "#8f7448" } },

  // Fruit trees: the ripe tree, and the same tree bare (the *_Harvested file).
  AppleTree: { from: "Apple_4", recolor: { ...TREE, DarkRed: "#e0342a" } },
  AppleTreeBare: { from: "Apple_Harvested", recolor: TREE },
  LemonTree: { from: "Orange_4", recolor: { ...TREE, Orange: "#f7dc3c" } },
  PeachTree: { from: "Orange_4", recolor: { ...TREE, Orange: "#f9a27a" } },
  MangoTree: { from: "Orange_4", recolor: { ...TREE, Orange: "#f6a325" } },
  OrangeTreeBare: { from: "Orange_Harvested", recolor: TREE },
  PearTree: { from: "Apple_4", recolor: { ...TREE, DarkRed: "#cddf5e" } },
  CherryTree: { from: "Apple_4", recolor: { ...BLOSSOM, DarkRed: "#c0122d" } },
  CherryTreeBare: { from: "Apple_Harvested", recolor: BLOSSOM },
  OliveTree: { from: "Apple_4", recolor: { ...OLIVE, DarkRed: "#55632d" } },
  OliveTreeBare: { from: "Apple_Harvested", recolor: OLIVE },
  AmberFigTree: { from: "Apple_4", recolor: { ...TREE, DarkRed: "#b9772e" } },
  VelvetPlumTree: { from: "Orange_4", recolor: { ...TREE, Orange: "#6e2f8f" } },
  StarappleTree: { from: "Apple_4", recolor: { ...TREE, DarkRed: "#ffd23f" } },
  CoconutPalm: { from: "PalmTree_4", recolor: { ...PALM, Coconuts: "#7a4e2c" } },
  CoconutPalmBare: { from: "PalmTree_Harvested", recolor: PALM },
};
