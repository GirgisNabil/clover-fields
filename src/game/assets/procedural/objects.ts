import type { BufferGeometry } from "three";
import type { PlantMesh } from "../plantManifest";
import { plantBounds, plantGeometry } from "../plants/library";
import { MeshBuilder, seededRandom, shade, stringSeed } from "./builder";
import { LARGE_DECOR_MODELS } from "./decorations";
import { ball, box, coneUp, cylinderUp, disc, gem, prism, rodUp } from "./shapes";
import { VEHICLE_MODELS } from "./vehicles";

/** A procedural model, built facing +x at rotation 0 and centered on its footprint. */
export interface ObjectModel {
  geometry: BufferGeometry;
  /** Approximate height, used for picking and bubble placement. */
  height: number;
}

type Variant = "default" | "fruit";

const WOOD = "#b07a45";
const DARK_WOOD = "#7a5230";
const LEAF = "#4e9a3c";

// ---------- trees ----------

const TREE_STYLE: Record<string, { canopy: string; fruit: string; palm?: true }> = {
  rosy_apple: { canopy: "#4e9a3c", fruit: "#e0362c" },
  sunny_lemon: { canopy: "#5aa43f", fruit: "#f7d84a" },
  blushing_peach: { canopy: "#57a046", fruit: "#f7a072" },
  snowdrop_cherry: { canopy: "#f4b3cf", fruit: "#c2182b" },
  bellpear: { canopy: "#5c9e3e", fruit: "#c5dc5f" },
  breezy_coconut: { canopy: "#3f9a46", fruit: "#7a5230", palm: true },
  silverleaf_olive: { canopy: "#93b386", fruit: "#4b5b2a" },
  monsoon_mango: { canopy: "#3e8f3a", fruit: "#f4a83a" },
};

/** Baked CC0 fruit trees: [with fruit, bare]. */
const BAKED_TREES: Record<string, [PlantMesh, PlantMesh]> = {
  rosy_apple: ["AppleTree", "AppleTreeBare"],
  sunny_lemon: ["LemonTree", "OrangeTreeBare"],
  blushing_peach: ["PeachTree", "OrangeTreeBare"],
  snowdrop_cherry: ["CherryTree", "CherryTreeBare"],
  bellpear: ["PearTree", "AppleTreeBare"],
  breezy_coconut: ["CoconutPalm", "CoconutPalmBare"],
  silverleaf_olive: ["OliveTree", "OliveTreeBare"],
  monsoon_mango: ["MangoTree", "OrangeTreeBare"],
  amber_fig: ["AmberFigTree", "AppleTreeBare"],
  velvet_plum: ["VelvetPlumTree", "OrangeTreeBare"],
  starapple: ["StarappleTree", "AppleTreeBare"],
};

/** Canopy width in tiles: a little wider than the 1×1 footprint so orchards look full. */
const TREE_WIDTH = 1.2;

function bakedTree(defId: string, variant: Variant): ObjectModel | null {
  const pair = BAKED_TREES[defId];
  if (!pair) return null;
  const name = variant === "fruit" ? pair[0] : pair[1];
  const base = plantGeometry(name);
  if (!base) return null;
  // Size from the fruiting tree so both variants match exactly.
  const { min, max } = plantBounds(pair[0]);
  const width = Math.max((max[0] ?? 1) - (min[0] ?? 0), (max[2] ?? 1) - (min[2] ?? 0));
  const k = TREE_WIDTH / width;
  const geometry = base.clone().scale(k, k, k);
  geometry.computeBoundingSphere();
  return { geometry, height: ((max[1] ?? 2) - (min[1] ?? 0)) * k };
}

function tree(defId: string, variant: Variant): ObjectModel {
  const baked = bakedTree(defId, variant);
  if (baked) return baked;
  const style = TREE_STYLE[defId] ?? { canopy: LEAF, fruit: "#e0362c" };
  const b = new MeshBuilder();
  const rnd = seededRandom(stringSeed(defId));
  if (style.palm) {
    for (let i = 0; i < 4; i++) {
      b.add(cylinderUp(0.06, 0.075, 0.3, 6), shade(DARK_WOOD, i * 0.05), {
        at: [i * 0.03, i * 0.28, 0],
        rot: [0, 0, -0.1],
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(coneUp(0.06, 0.55, 4), shade(style.canopy, (rnd() - 0.5) * 0.15), {
        at: [0.12, 1.12, 0],
        rot: [1.2, a, 0],
        order: "YXZ",
        scale: [1, 1, 0.35],
      });
    }
    if (variant === "fruit") {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        b.add(ball(0.06), style.fruit, {
          at: [0.12 + Math.cos(a) * 0.07, 1.06, Math.sin(a) * 0.07],
        });
      }
    }
    return { geometry: b.build(), height: 1.4 };
  }
  b.add(cylinderUp(0.06, 0.09, 0.5, 6), DARK_WOOD);
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.72, 0, 0.32],
    [0.18, 0.62, 0.1, 0.22],
    [-0.15, 0.64, -0.12, 0.22],
    [0.02, 0.92, -0.05, 0.2],
  ];
  for (const [x, y, z, r] of blobs) {
    b.add(ball(r, 1), shade(style.canopy, (rnd() - 0.5) * 0.12), { at: [x, y, z] });
  }
  const fruitCount = variant === "fruit" ? 9 : 0;
  for (let i = 0; i < fruitCount; i++) {
    const a = rnd() * Math.PI * 2;
    const e = -0.3 + rnd() * 1.1;
    const r = 0.33;
    b.add(ball(0.05), style.fruit, {
      at: [Math.cos(e) * Math.cos(a) * r, 0.72 + Math.sin(e) * r, Math.cos(e) * Math.sin(a) * r],
    });
  }
  return { geometry: b.build(), height: 1.15 };
}

// ---------- animals (facing +x) ----------

function legs(b: MeshBuilder, color: string, spread: number, height: number, r = 0.025) {
  for (const x of [-spread, spread]) {
    for (const z of [-spread * 0.7, spread * 0.7])
      b.add(rodUp(r, height), color, { at: [x, 0, z] });
  }
}

function bird(body: string, accent: string, beak: string): ObjectModel {
  const b = new MeshBuilder();
  b.add(ball(0.15, 1), body, { at: [0, 0.2, 0], scale: [1.25, 1, 0.95] });
  b.add(coneUp(0.08, 0.15, 5), shade(body, -0.15), { at: [-0.16, 0.2, 0], rot: [0, 0, 1.2] });
  b.add(ball(0.085, 1), body, { at: [0.15, 0.36, 0] });
  b.add(coneUp(0.025, 0.07, 4), beak, { at: [0.22, 0.36, 0], rot: [0, 0, -Math.PI / 2] });
  b.add(gem(0.035), accent, { at: [0.15, 0.45, 0], scale: [1.4, 1, 0.5] });
  for (const z of [-0.035, 0.035]) b.add(gem(0.012), "#222", { at: [0.215, 0.38, z] });
  for (const z of [-0.05, 0.05]) b.add(rodUp(0.012, 0.09), beak, { at: [0.01, 0, z] });
  return { geometry: b.build(), height: 0.5 };
}

function quadruped(opts: {
  body: string;
  head: string;
  leg: string;
  size: number;
  fluffy?: boolean;
  spots?: string;
  horns?: string;
  snout?: string;
  mane?: string;
}): ObjectModel {
  const b = new MeshBuilder();
  const s = opts.size;
  const rnd = seededRandom(stringSeed(opts.body + opts.head));
  legs(b, opts.leg, 0.16 * s, 0.22 * s, 0.03 * s);
  if (opts.fluffy) {
    for (let i = 0; i < 6; i++) {
      b.add(ball(0.14 * s, 1), shade(opts.body, (rnd() - 0.5) * 0.06), {
        at: [
          (i % 3) * 0.12 * s - 0.12 * s,
          0.36 * s + (i > 2 ? 0.07 * s : 0),
          (i > 2 ? 0.05 : -0.05) * s,
        ],
      });
    }
  } else {
    b.add(ball(0.2 * s, 1), opts.body, { at: [0, 0.36 * s, 0], scale: [1.45, 0.95, 0.9] });
  }
  if (opts.spots) {
    for (let i = 0; i < 5; i++) {
      b.add(gem(0.07 * s), opts.spots, {
        at: [
          (rnd() - 0.5) * 0.4 * s,
          0.4 * s + (rnd() - 0.3) * 0.1 * s,
          (rnd() > 0.5 ? 1 : -1) * 0.16 * s,
        ],
        scale: [1.2, 1, 0.3],
      });
    }
  }
  b.add(ball(0.12 * s, 1), opts.head, { at: [0.3 * s, 0.5 * s, 0] });
  if (opts.snout)
    b.add(ball(0.06 * s), opts.snout, { at: [0.41 * s, 0.47 * s, 0], scale: [0.8, 0.8, 1] });
  for (const z of [-0.05 * s, 0.05 * s])
    b.add(gem(0.018 * s), "#222", { at: [0.39 * s, 0.54 * s, z] });
  for (const z of [-0.08 * s, 0.08 * s]) {
    b.add(gem(0.05 * s), shade(opts.head, -0.1), {
      at: [0.27 * s, 0.6 * s, z],
      scale: [0.6, 1, 1.4],
    });
    if (opts.horns)
      b.add(coneUp(0.02 * s, 0.08 * s, 4), opts.horns, { at: [0.3 * s, 0.6 * s, z * 0.6] });
  }
  if (opts.mane)
    b.add(box(0.28 * s, 0.06 * s, 0.05 * s), opts.mane, {
      at: [0.16 * s, 0.6 * s, 0],
      rot: [0, 0, -0.5],
    });
  b.add(coneUp(0.025 * s, 0.14 * s, 4), opts.mane ?? shade(opts.body, -0.1), {
    at: [-0.3 * s, 0.4 * s, 0],
    rot: [0, 0, 2.3],
  });
  return { geometry: b.build(), height: 0.75 * s };
}

function scaled(model: ObjectModel, k: number): ObjectModel {
  model.geometry.scale(k, k, k);
  model.geometry.computeBoundingBox();
  model.geometry.computeBoundingSphere();
  return { geometry: model.geometry, height: model.height * k };
}

const ANIMAL_MODELS: Record<string, () => ObjectModel> = {
  russet_hen: () => scaled(bird("#b5532d", "#e2392f", "#f2a41c"), 1.5),
  puddle_duck: () => scaled(bird("#f4f1e6", "#3c8f5a", "#f28a1b"), 1.5),
  puffwool_sheep: () =>
    quadruped({ body: "#f5f2ea", head: "#3b3b3b", leg: "#3b3b3b", size: 0.9, fluffy: true }),
  nanny_goat: () =>
    quadruped({ body: "#e8e1d3", head: "#e8e1d3", leg: "#cfc6b4", size: 0.9, horns: "#9a8a6a" }),
  dapple_cow: () =>
    quadruped({
      body: "#f7f5ef",
      head: "#f7f5ef",
      leg: "#efeae0",
      size: 1.7,
      spots: "#2e2a26",
      horns: "#e8dcc0",
      snout: "#f2b8a8",
    }),
  truffle_pig: () =>
    quadruped({ body: "#f3a7b5", head: "#f3a7b5", leg: "#e88fa0", size: 0.95, snout: "#e57f95" }),
  meadow_donkey: () =>
    quadruped({
      body: "#9a9389",
      head: "#9a9389",
      leg: "#6f6a62",
      size: 1.6,
      mane: "#4a4540",
      snout: "#d6cfc2",
    }),
  chestnut_horse: () =>
    quadruped({ body: "#8b4a2b", head: "#8b4a2b", leg: "#5e3220", size: 1.75, mane: "#2e1d14" }),
};

// ---------- decorations ----------

function railFence(): ObjectModel {
  const b = new MeshBuilder();
  for (const x of [-0.42, 0.42]) b.add(box(0.08, 0.42, 0.08), DARK_WOOD, { at: [x, 0.21, 0] });
  for (const y of [0.17, 0.32]) b.add(box(0.94, 0.06, 0.05), WOOD, { at: [0, y, 0] });
  return { geometry: b.build(), height: 0.42 };
}

function scarecrow(): ObjectModel {
  const b = new MeshBuilder();
  b.add(rodUp(0.03, 0.75), DARK_WOOD);
  b.add(box(0.12, 0.25, 0.22), "#c0392b", { at: [0, 0.5, 0] });
  b.add(box(0.05, 0.05, 0.6), DARK_WOOD, { at: [0, 0.55, 0] });
  for (const z of [-0.3, 0.3])
    b.add(gem(0.05), "#e8c35a", { at: [0, 0.55, z], scale: [1, 1.4, 1] });
  b.add(ball(0.09, 1), "#d9b77e", { at: [0, 0.73, 0] });
  b.add(disc(0.16, 0.015, 10), "#e8c35a", { at: [0, 0.8, 0] });
  b.add(coneUp(0.08, 0.12, 8), "#d8b24a", { at: [0, 0.8, 0] });
  return { geometry: b.build(), height: 0.95 };
}

function flowerBed(colors: string[]): ObjectModel {
  const b = new MeshBuilder();
  const rnd = seededRandom(stringSeed(colors.join()));
  b.add(ball(0.36), "#7a4d26", { at: [0, 0.02, 0], scale: [1, 0.2, 1] });
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.25;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    b.add(rodUp(0.008, 0.14), "#4f8f2f", { at: [x, 0.04, z] });
    b.add(gem(0.04), colors[i % colors.length] ?? "#fff", {
      at: [x, 0.19, z],
      scale: [1, 0.45, 1],
    });
    b.add(gem(0.015), "#f7c629", { at: [x, 0.205, z] });
  }
  return { geometry: b.build(), height: 0.3 };
}

function steppingStones(): ObjectModel {
  const b = new MeshBuilder();
  for (const [x, z, r] of [
    [-0.2, -0.18, 0.15],
    [0.15, 0.05, 0.17],
    [-0.12, 0.25, 0.12],
  ] as const) {
    b.add(disc(r, 0.04, 7), "#b9b4aa", { at: [x, 0.02, z] });
  }
  return { geometry: b.build(), height: 0.05 };
}

function rainBarrel(): ObjectModel {
  const b = new MeshBuilder();
  b.add(cylinderUp(0.2, 0.18, 0.45, 10), "#8a5a33");
  for (const y of [0.08, 0.37]) b.add(disc(0.205, 0.03, 10), "#4a4a4a", { at: [0, y, 0] });
  b.add(disc(0.17, 0.01, 10), "#5aa9d6", { at: [0, 0.44, 0] });
  return { geometry: b.build(), height: 0.46 };
}

function lanternPost(): ObjectModel {
  const b = new MeshBuilder();
  b.add(rodUp(0.03, 0.9), "#2f2f2f");
  b.add(box(0.14, 0.16, 0.14), "#ffd56b", { at: [0, 0.98, 0] });
  b.add(coneUp(0.12, 0.08, 4), "#2f2f2f", { at: [0, 1.06, 0], rot: [0, Math.PI / 4, 0] });
  return { geometry: b.build(), height: 1.15 };
}

function bench(): ObjectModel {
  const b = new MeshBuilder();
  b.add(box(1.6, 0.06, 0.4), WOOD, { at: [0, 0.32, 0] });
  b.add(box(1.6, 0.3, 0.05), WOOD, { at: [0, 0.5, -0.18] });
  for (const x of [-0.7, 0.7]) b.add(box(0.07, 0.32, 0.36), "#3d3d3d", { at: [x, 0.16, 0] });
  return { geometry: b.build(), height: 0.65 };
}

/** A golden cup on a stone plinth; each set's trophy gets its own ribbon color. */
function trophy(defId: string): ObjectModel {
  const b = new MeshBuilder();
  const rnd = seededRandom(stringSeed(defId));
  const ribbon = ["#e05a47", "#3aa0ff", "#4cb92c", "#b56cff", "#ff8fb1", "#f4a937"][
    Math.floor(rnd() * 6)
  ] as string;
  b.add(box(0.5, 0.18, 0.5), "#b9b2a6", { at: [0, 0.09, 0] });
  b.add(box(0.38, 0.06, 0.38), "#d8d2c6", { at: [0, 0.21, 0] });
  b.add(cylinderUp(0.05, 0.1, 0.18, 10), "#e6b422", { at: [0, 0.24, 0] });
  b.add(cylinderUp(0.18, 0.08, 0.26, 12), "#f6c945", { at: [0, 0.42, 0] });
  b.add(disc(0.185, 0.03, 12), "#e6b422", { at: [0, 0.68, 0] });
  for (const side of [-1, 1]) {
    b.add(box(0.04, 0.16, 0.04), "#e6b422", { at: [side * 0.22, 0.56, 0] });
  }
  b.add(box(0.06, 0.2, 0.02), ribbon, { at: [0.08, 0.32, 0.17], rot: [0, 0, 0.2] });
  b.add(box(0.06, 0.2, 0.02), ribbon, { at: [-0.08, 0.32, 0.17], rot: [0, 0, -0.2] });
  return { geometry: b.build(), height: 0.75 };
}

/** Two posts with a sagging string of glowing paper lanterns between them. */
function lanternString(): ObjectModel {
  const b = new MeshBuilder();
  for (const x of [-0.85, 0.85]) {
    b.add(rodUp(0.04, 1.3), DARK_WOOD, { at: [x, 0, 0] });
    b.add(ball(0.06), "#ffd56b", { at: [x, 1.32, 0] });
  }
  const colors = ["#ff6a3d", "#ffb13d", "#ff4f6d", "#ffd23f", "#ff8a1f"];
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const x = -0.85 + t * 1.7;
    const y = 1.22 - Math.sin(t * Math.PI) * 0.22;
    b.add(rodUp(0.006, 0.08), "#3b2a1a", { at: [x, y - 0.02, 0] });
    b.add(ball(0.08, 1), colors[i] ?? "#ffb13d", { at: [x, y - 0.1, 0], scale: [1, 1.25, 1] });
    b.add(disc(0.05, 0.02, 8), "#5a3a1a", { at: [x, y - 0.2, 0] });
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    b.add(box(0.15, 0.01, 0.01), "#3b2a1a", {
      at: [-0.85 + t * 1.7, 1.24 - Math.sin(t * Math.PI) * 0.22, 0],
    });
  }
  return { geometry: b.build(), height: 1.4 };
}

const DECOR_MODELS: Record<string, () => ObjectModel> = {
  ...LARGE_DECOR_MODELS,
  lantern_string: lanternString,
  rail_fence: railFence,
  straw_sentinel: scarecrow,
  daisy_bed: () => flowerBed(["#ffffff", "#fffbe6"]),
  bloom_barrow: () => flowerBed(["#ff6fae", "#ffd23f", "#b56cff"]),
  stepping_stones: steppingStones,
  rain_barrel: rainBarrel,
  lantern_post: lanternPost,
  garden_bench: bench,
};

// ---------- buildings ----------

function shed(
  width: number,
  depth: number,
  wall: string,
  roof: string,
  trim: string,
  extra?: (b: MeshBuilder, w: number, d: number) => number,
): ObjectModel {
  const b = new MeshBuilder();
  const w = width - 0.35;
  const d = depth - 0.35;
  const wallH = 0.95;
  b.add(box(w, wallH, d), wall, { at: [0, wallH / 2, 0] });
  b.add(prism(w + 0.25, d + 0.3, 0.7), roof, { at: [0, wallH, 0] });
  // Door on the +z face, window on the +x face (both face the camera).
  b.add(box(0.48, 0.72, 0.04), shade(wall, -0.25), { at: [0, 0.36, d / 2 + 0.02] });
  b.add(box(0.5, 0.06, 0.05), trim, { at: [0, 0.74, d / 2 + 0.03] });
  b.add(box(0.04, 0.32, 0.36), "#bfe3f5", { at: [w / 2 + 0.02, 0.55, 0] });
  b.add(box(0.05, 0.4, 0.06), trim, { at: [w / 2 + 0.03, 0.55, 0] });
  for (const [x, z] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ] as const) {
    b.add(box(0.07, wallH, 0.07), trim, { at: [x, wallH / 2, z] });
  }
  const top = extra?.(b, w, d) ?? 0;
  return { geometry: b.build(), height: Math.max(wallH + 0.7, top) };
}

/** A stone tower on the right-hand corner, with four sails facing the camera. */
function millTower(b: MeshBuilder, w: number, d: number): number {
  const x = w / 2 - 0.4;
  const z = -d / 2 + 0.4;
  b.add(cylinderUp(0.3, 0.4, 2.5, 8), "#d8cfc0", { at: [x, 0, z] });
  b.add(coneUp(0.38, 0.5, 8), "#7a4a2a", { at: [x, 2.5, z] });
  // The sails turn about the (+x, +z) axis, the side the camera looks from.
  const hub: [number, number, number] = [x + 0.28, 2.2, z + 0.28];
  b.add(ball(0.08), DARK_WOOD, { at: hub });
  const r = 0.5;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const k = Math.sin(a) * r * Math.SQRT1_2;
    b.add(box(0.2, 0.95, 0.025), "#f3e4c3", {
      at: [hub[0] + k, hub[1] + Math.cos(a) * r, hub[2] - k],
      rot: [0, Math.PI / 4, -a],
    });
  }
  return 3.0;
}

/** A brick chimney and a striped awning over the door. */
function bakeryTrim(b: MeshBuilder, w: number, d: number): number {
  b.add(box(0.3, 0.9, 0.3), "#a5523a", { at: [w / 2 - 0.45, 1.35, -d / 4] });
  b.add(box(0.36, 0.08, 0.36), "#6d3a2a", { at: [w / 2 - 0.45, 1.82, -d / 4] });
  for (let i = 0; i < 4; i++) {
    b.add(box(0.2, 0.04, 0.32), i % 2 ? "#ffffff" : "#e05a47", {
      at: [-0.3 + i * 0.2, 0.86, d / 2 + 0.16],
      rot: [0.35, 0, 0],
    });
  }
  return 1.9;
}

/** Barrels and a big screw press beside the building. */
function pressTrim(b: MeshBuilder, w: number, d: number): number {
  for (const [x, z] of [
    [w / 2 - 0.3, d / 2 + 0.05],
    [w / 2 - 0.75, d / 2 + 0.1],
  ] as const) {
    b.add(cylinderUp(0.17, 0.15, 0.36, 10), "#8a5a33", { at: [x, 0, z] });
    b.add(disc(0.175, 0.025, 10), "#4a4a4a", { at: [x, 0.28, z] });
  }
  b.add(rodUp(0.04, 0.5), "#4a4a4a", { at: [-w / 2 + 0.35, 1.6, 0] });
  b.add(disc(0.22, 0.05, 6), DARK_WOOD, { at: [-w / 2 + 0.35, 2.1, 0] });
  b.add(cylinderUp(0.12, 0.12, 0.18, 8), "#7b3f8c", { at: [w / 2 - 0.3, 0.36, d / 2 + 0.05] });
  return 2.15;
}

/** A wide roll-up door and a fuel pump. */
function garageTrim(b: MeshBuilder, w: number, d: number): number {
  b.add(box(1.4, 0.78, 0.04), "#9aa3ad", { at: [-0.5, 0.39, d / 2 + 0.03] });
  for (let i = 1; i < 5; i++)
    b.add(box(1.4, 0.02, 0.05), "#6f7780", { at: [-0.5, i * 0.16, d / 2 + 0.04] });
  b.add(box(0.22, 0.6, 0.18), "#d9412b", { at: [w / 2 - 0.2, 0.3, d / 2 + 0.2] });
  b.add(box(0.16, 0.12, 0.02), "#fff8ea", { at: [w / 2 - 0.2, 0.45, d / 2 + 0.3] });
  return 1.65;
}

/** Silk cocoons hanging under the eaves and a round moon window. */
function mothTrim(b: MeshBuilder, w: number, d: number): number {
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.25 + (i * (w - 0.5)) / 3;
    b.add(rodUp(0.008, 0.12), "#f3e4c3", { at: [x, 0.83, d / 2 + 0.12] });
    b.add(ball(0.05, 1), "#fbf7ef", { at: [x, 0.8, d / 2 + 0.12], scale: [0.8, 1.3, 0.8] });
  }
  b.add(disc(0.16, 0.04, 12), "#bfe3f5", { at: [w / 2 + 0.02, 0.55, 0], rot: [0, 0, Math.PI / 2] });
  return 1.7;
}

const BUILDING_MODELS: Record<string, () => ObjectModel> = {
  silk_moth_hut: () => shed(2, 2, "#efe3f7", "#8b63b5", "#fff8ea", mothTrim),
  tool_shed: () => shed(3, 2, "#a0643a", "#5d4037", "#f3e4c3"),
  hen_house: () => shed(4, 3, "#d9a441", "#a8432f", "#fff8ea"),
  red_barn: () => shed(5, 4, "#c0392b", "#5d4037", "#ffffff"),
  hoofbeat_stable: () => shed(5, 4, "#8d6748", "#4a3a2c", "#f3e4c3"),
  windgrist_mill: () => shed(3, 3, "#e9d7b5", "#6d8f4e", "#7a5230", millTower),
  crumbhearth_bakery: () => shed(3, 3, "#f2c98c", "#b4553f", "#fff8ea", bakeryTrim),
  pippin_press: () => shed(3, 2, "#c4aee0", "#8a5fa8", "#fff8ea", pressTrim),
  gearhouse_garage: () => shed(4, 3, "#7f8c99", "#3f4a55", "#f2c94c", garageTrim),
};

// ---------- lookup ----------

const cache = new Map<string, ObjectModel | null>();

export function objectModel(
  kind: string,
  defId: string,
  variant: Variant = "default",
): ObjectModel | null {
  const key = `${kind}:${defId}:${variant}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let model: ObjectModel | null = null;
  if (kind === "tree") model = tree(defId, variant);
  else if (kind === "animal") model = ANIMAL_MODELS[defId]?.() ?? null;
  else if (kind === "decoration")
    model = DECOR_MODELS[defId]?.() ?? (defId.startsWith("trophy_") ? trophy(defId) : null);
  else if (kind === "building") model = BUILDING_MODELS[defId]?.() ?? null;
  else if (kind === "vehicle") model = VEHICLE_MODELS[defId]?.() ?? null;
  cache.set(key, model);
  return model;
}
