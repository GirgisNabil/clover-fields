import { type BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlantMesh } from "../plantManifest";
import { seededRandom, stringSeed } from "../procedural/builder";
import type { CropVisual } from "../procedural/crops";
import { plantGeometry } from "./library";

type Layout = "grid4" | "grid3" | "grid2" | "single";

export interface CropLook {
  /** Baked mesh prefix: `${prefix}_1` … `${prefix}_4`. */
  prefix: string;
  layout: Layout;
  /** Uniform scale applied to every plant. */
  scale: number;
  /** Several prefixes to alternate between plants (mixed flower colors). */
  mix?: readonly string[];
  /** Extra mesh added on top of each ripe plant (pineapple fruit). */
  ripeTop?: { mesh: PlantMesh; y: number; scale: [number, number, number] };
  /** Use a single mesh (scaled by stage) instead of the four stage files. */
  only?: PlantMesh;
}

/** Every crop's look. A vitest checks each crop id has one and every mesh exists. */
export const CROP_LOOKS: Readonly<Record<string, CropLook>> = {
  clover_sprout: { prefix: "Clover", layout: "grid3", scale: 0.6 },
  sunpop_berry: { prefix: "Strawberry", layout: "single", scale: 0.56 },
  button_carrot: { prefix: "Carrot", layout: "grid3", scale: 0.62 },
  goldenstalk_wheat: { prefix: "Wheat", layout: "grid4", scale: 0.72 },
  tumble_pea: { prefix: "Pea", layout: "grid2", scale: 0.52 },
  bluebell_berry: { prefix: "Blueberry", layout: "single", scale: 0.56 },
  ruby_tomato: { prefix: "Tomato", layout: "grid2", scale: 0.5 },
  sweetcob_corn: { prefix: "Corn", layout: "grid2", scale: 0.56 },
  hillside_potato: { prefix: "Potato", layout: "grid3", scale: 0.62 },
  fire_pepper: { prefix: "Pepper", layout: "grid2", scale: 0.48 },
  moon_melon: { prefix: "Melon", layout: "single", scale: 0.72 },
  patchwork_pumpkin: { prefix: "Pumpkin", layout: "single", scale: 0.74 },
  sunflower_crown: { prefix: "Sunflower", layout: "grid2", scale: 1.0 },
  velvet_eggplant: { prefix: "Eggplant", layout: "grid2", scale: 0.5 },
  lavender_plume: { prefix: "Lavender", layout: "grid2", scale: 0.75 },
  twilight_grape: { prefix: "Grape", layout: "single", scale: 0.56 },
  frost_cabbage: { prefix: "Cabbage", layout: "grid2", scale: 0.62 },
  sunburst_pineapple: {
    prefix: "PalmTree",
    only: "PalmTree_1",
    layout: "grid2",
    scale: 1.3,
    ripeTop: { mesh: "PineappleFruit", y: 0.16, scale: [0.9, 1.4, 0.9] },
  },
  ember_rose: { prefix: "Rose", layout: "grid3", scale: 0.7 },
  rainbow_tulip: {
    prefix: "TulipPink",
    layout: "grid3",
    scale: 0.7,
    mix: ["TulipPink", "TulipGold", "TulipViolet"],
  },
  moonpetal_lotus: { prefix: "Lilypad", layout: "single", scale: 0.82, only: "Lilypad" },
  golden_garlic: { prefix: "Garlic", layout: "grid3", scale: 0.6 },
  // Late-game crops
  pebble_radish: { prefix: "Radish", layout: "grid3", scale: 0.62 },
  silverleaf_lettuce: { prefix: "Silverleaf", layout: "grid2", scale: 0.62 },
  cinnamon_corn: { prefix: "CinnamonCorn", layout: "grid2", scale: 0.56 },
  starlight_squash: { prefix: "StarSquash", layout: "single", scale: 0.74 },
  cocoa_pod: { prefix: "Cocoa", layout: "grid2", scale: 0.5 },
  glimmer_lily: { prefix: "GlimmerLily", layout: "grid3", scale: 0.7 },
  royal_rice: { prefix: "RoyalRice", layout: "grid2", scale: 0.75 },
  dragonscale_gourd: { prefix: "DragonGourd", layout: "single", scale: 0.78 },
  // Seasonal event crops
  lantern_gourd: { prefix: "LanternGourd", layout: "single", scale: 0.74 },
  frostberry: { prefix: "Frostberry", layout: "single", scale: 0.56 },
  petalbloom: { prefix: "Petalbloom", layout: "grid3", scale: 0.7 },
  sunmelon: { prefix: "Sunmelon", layout: "single", scale: 0.72 },
};

const SPOTS: Record<Layout, number[]> = {
  grid4: [-0.3, -0.1, 0.1, 0.3],
  grid3: [-0.27, 0, 0.27],
  grid2: [-0.19, 0.19],
  single: [0],
};

/** Which stage file each growth visual uses, and how big it is drawn. */
const STAGE: Record<Exclude<CropVisual, "ripe">, { file: 1 | 2 | 3; size: number }> = {
  0: { file: 1, size: 1.1 },
  1: { file: 2, size: 0.9 },
  2: { file: 3, size: 0.85 },
  3: { file: 3, size: 1 },
};

const matrix = new Matrix4();
const quat = new Quaternion();
const euler = new Euler();
const pos = new Vector3();
const scl = new Vector3();

/**
 * One tile of a crop at one growth visual, merged into a single geometry, or null if the baked
 * plants aren't available (the caller then falls back to the procedural crop).
 */
export function bakedCropGeometry(cropId: string, visual: CropVisual): BufferGeometry | null {
  const look = CROP_LOOKS[cropId];
  if (!look) return null;
  const file = visual === "ripe" ? 4 : STAGE[visual].file;
  const size = visual === "ripe" ? 1 : STAGE[visual].size;
  const rnd = seededRandom(stringSeed(`${cropId}:${visual}`));
  const parts: BufferGeometry[] = [];
  const offsets = SPOTS[look.layout];
  let n = 0;
  for (const x of offsets) {
    for (const z of offsets) {
      const prefix = look.mix ? (look.mix[n % look.mix.length] ?? look.prefix) : look.prefix;
      n++;
      const name = (look.only ?? `${prefix}_${file}`) as PlantMesh;
      const base = plantGeometry(name);
      if (!base) return null;
      const jitter = look.layout === "single" ? 0 : 0.05;
      const s =
        look.scale *
        (look.only ? ([0.45, 0.6, 0.8, 0.9][file - 1] ?? 1) : size) *
        (0.9 + rnd() * 0.2);
      pos.set(x + (rnd() - 0.5) * jitter, 0, z + (rnd() - 0.5) * jitter);
      quat.setFromEuler(euler.set(0, rnd() * Math.PI * 2, 0));
      matrix.compose(pos, quat, scl.setScalar(s));
      parts.push(base.clone().applyMatrix4(matrix));
      if (visual === "ripe" && look.ripeTop) {
        const top = plantGeometry(look.ripeTop.mesh);
        if (top) {
          const [sx, sy, sz] = look.ripeTop.scale;
          pos.y = look.ripeTop.y * look.scale;
          matrix.compose(pos, quat, scl.set(sx * s, sy * s, sz * s));
          parts.push(top.clone().applyMatrix4(matrix));
        }
      }
    }
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}
