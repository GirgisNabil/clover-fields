import { MeshBuilder } from "./builder";
import { ball, box, coneUp, cylinderUp, disc, gem, prism, rodUp } from "./shapes";

// Procedural models for the larger shop decorations (no fitting free model exists).
// Built facing +x at rotation 0 and centered on their footprint, like objects.ts.

export interface DecorModel {
  geometry: ReturnType<MeshBuilder["build"]>;
  height: number;
}

const STONE = "#c9c2b5";
const STONE_DARK = "#a39b8d";
const GOLD = "#f6c945";
const GOLD_DARK = "#d9a52a";
const HEDGE = "#4f9a3a";
const HEDGE_DARK = "#3f8530";
const DARK_WOOD = "#7a5230";

/** A row of short segments along a half circle (arches, rainbows). */
function arc(
  b: MeshBuilder,
  radius: number,
  thickness: number,
  depth: number,
  color: string,
  segments = 14,
  y0 = 0,
) {
  for (let i = 0; i < segments; i++) {
    const a = ((i + 0.5) / segments) * Math.PI;
    const len = (Math.PI * radius) / segments + 0.02;
    b.add(box(len, thickness, depth), color, {
      at: [Math.cos(a) * radius, y0 + Math.sin(a) * radius, 0],
      rot: [0, 0, a + Math.PI / 2],
    });
  }
}

function cloverStatue(): DecorModel {
  const b = new MeshBuilder();
  b.add(box(1.5, 0.3, 1.5), STONE_DARK, { at: [0, 0.15, 0] });
  b.add(box(0.9, 0.6, 0.9), STONE, { at: [0, 0.6, 0] });
  b.add(rodUp(0.06, 0.35), GOLD_DARK, { at: [0, 0.9, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    b.add(ball(0.24, 1), GOLD, {
      at: [Math.cos(a) * 0.22, 1.45, Math.sin(a) * 0.22 * 0.4],
      scale: [1, 1, 0.35],
    });
  }
  b.add(ball(0.08), GOLD_DARK, { at: [0, 1.45, 0] });
  return { geometry: b.build(), height: 1.8 };
}

function lanternTree(): DecorModel {
  const b = new MeshBuilder();
  b.add(cylinderUp(0.07, 0.1, 0.9, 6), DARK_WOOD);
  for (const [x, y, z, r] of [
    [0, 1.05, 0, 0.36],
    [0.2, 0.95, 0.12, 0.24],
    [-0.18, 0.98, -0.1, 0.24],
  ] as const) {
    b.add(ball(r, 1), "#3f6fa0", { at: [x, y, z] });
  }
  const glow = ["#ffd56b", "#ffe9a8", "#ffc14a"];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.add(ball(0.05), glow[i % 3] ?? "#ffd56b", {
      at: [Math.cos(a) * 0.38, 0.86 + (i % 2) * 0.12, Math.sin(a) * 0.38],
    });
  }
  return { geometry: b.build(), height: 1.45 };
}

function topiarySwan(): DecorModel {
  const b = new MeshBuilder();
  b.add(cylinderUp(0.3, 0.34, 0.22, 10), "#b06b3c");
  b.add(ball(0.3, 1), HEDGE, { at: [0, 0.45, 0], scale: [1.3, 0.8, 0.9] });
  b.add(ball(0.18, 1), HEDGE_DARK, { at: [-0.15, 0.55, 0.12], scale: [1.2, 0.5, 0.6] });
  b.add(ball(0.18, 1), HEDGE_DARK, { at: [-0.15, 0.55, -0.12], scale: [1.2, 0.5, 0.6] });
  b.add(cylinderUp(0.06, 0.08, 0.5, 6), HEDGE, { at: [0.28, 0.5, 0], rot: [0, 0, -0.25] });
  b.add(ball(0.1, 1), HEDGE, { at: [0.4, 1.0, 0] });
  b.add(coneUp(0.04, 0.12, 5), "#f4a937", { at: [0.48, 0.98, 0], rot: [0, 0, -Math.PI / 2] });
  return { geometry: b.build(), height: 1.1 };
}

function rainbowArch(): DecorModel {
  const b = new MeshBuilder();
  const colors = ["#e05a47", "#f4a937", "#f6d845", "#4cb92c", "#3aa0ff", "#8a5ad8"];
  colors.forEach((c, i) => {
    arc(b, 1.25 - i * 0.09, 0.09, 0.22, c, 18, 0.15);
  });
  for (const x of [-1.3, 1.3]) {
    b.add(ball(0.32, 1), "#ffffff", { at: [x, 0.2, 0], scale: [1, 0.7, 0.9] });
    b.add(ball(0.22, 1), "#f2f6ff", { at: [x * 0.88, 0.32, 0.08], scale: [1, 0.7, 0.9] });
  }
  return { geometry: b.build(), height: 1.45 };
}

function hedgeArch(): DecorModel {
  const b = new MeshBuilder();
  for (const x of [-0.75, 0.75]) b.add(box(0.36, 1.1, 0.5), HEDGE, { at: [x, 0.55, 0] });
  arc(b, 0.75, 0.32, 0.5, HEDGE_DARK, 12, 1.05);
  for (const x of [-0.75, 0.75]) b.add(box(0.42, 0.12, 0.56), "#b06b3c", { at: [x, 0.06, 0] });
  return { geometry: b.build(), height: 1.85 };
}

function telescope(): DecorModel {
  const b = new MeshBuilder();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(rodUp(0.025, 0.85), DARK_WOOD, {
      at: [Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18],
      rot: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25],
    });
  }
  b.add(cylinderUp(0.07, 0.1, 0.75, 10), "#b98a4a", { at: [-0.25, 0.7, 0], rot: [0, 0, -1.0] });
  b.add(disc(0.11, 0.05, 10), GOLD_DARK, { at: [0.36, 1.12, 0], rot: [0, 0, -1.0 + Math.PI / 2] });
  return { geometry: b.build(), height: 1.3 };
}

function weathervane(): DecorModel {
  const b = new MeshBuilder();
  b.add(box(0.36, 0.12, 0.36), STONE, { at: [0, 0.06, 0] });
  b.add(rodUp(0.03, 1.5), "#b87333", { at: [0, 0.12, 0] });
  b.add(box(0.62, 0.03, 0.03), "#b87333", { at: [0, 1.3, 0] });
  b.add(box(0.03, 0.03, 0.62), "#b87333", { at: [0, 1.3, 0] });
  b.add(coneUp(0.06, 0.14, 4), "#b87333", { at: [0.3, 1.3, 0], rot: [0, 0, -Math.PI / 2] });
  b.add(box(0.36, 0.2, 0.02), "#c4824a", { at: [0, 1.62, 0] });
  b.add(ball(0.05), "#c4824a", { at: [0.16, 1.72, 0] });
  return { geometry: b.build(), height: 1.8 };
}

function bandstand(): DecorModel {
  const b = new MeshBuilder();
  b.add(cylinderUp(1.25, 1.3, 0.3, 8), STONE, {});
  b.add(cylinderUp(1.18, 1.18, 0.05, 8), "#e9dcc4", { at: [0, 0.3, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(rodUp(0.05, 1.3), "#ffffff", { at: [Math.cos(a) * 1.08, 0.3, Math.sin(a) * 1.08] });
  }
  b.add(coneUp(1.45, 0.85, 8), "#e05a47", { at: [0, 1.6, 0] });
  b.add(ball(0.1), GOLD, { at: [0, 2.48, 0] });
  b.add(cylinderUp(1.4, 1.4, 0.06, 8), "#ffffff", { at: [0, 1.58, 0] });
  return { geometry: b.build(), height: 2.6 };
}

function balloonMooring(): DecorModel {
  const b = new MeshBuilder();
  b.add(box(0.5, 0.36, 0.5), "#b5803f", { at: [0, 0.18, 0] });
  b.add(box(0.54, 0.05, 0.54), DARK_WOOD, { at: [0, 0.38, 0] });
  for (const [x, z] of [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ] as const) {
    b.add(rodUp(0.008, 0.85), "#3b2a1a", { at: [x, 0.38, z], rot: [-z * 0.5, 0, x * 0.5] });
  }
  const stripes = ["#e05a47", "#ffd23f", "#3aa0ff", "#ffd23f"];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(ball(0.62, 1), stripes[i % 4] ?? "#e05a47", {
      at: [Math.cos(a) * 0.05, 1.85, Math.sin(a) * 0.05],
      rot: [0, a, 0],
      scale: [0.35, 1.15, 1],
    });
  }
  b.add(coneUp(0.3, 0.4, 8), "#e05a47", { at: [0, 1.0, 0], rot: [Math.PI, 0, 0] });
  for (const x of [-0.9, 0.9]) b.add(rodUp(0.03, 0.3), DARK_WOOD, { at: [x, 0, 0] });
  return { geometry: b.build(), height: 2.6 };
}

function conservatory(): DecorModel {
  const b = new MeshBuilder();
  const w = 3.6;
  const d = 2.6;
  b.add(box(w, 0.2, d), STONE, { at: [0, 0.1, 0] });
  b.add(box(w - 0.1, 1.2, d - 0.1), "#bfe6f2", { at: [0, 0.8, 0] });
  for (let i = 0; i <= 6; i++) {
    const x = -w / 2 + (i * w) / 6;
    b.add(box(0.06, 1.25, 0.06), "#ffffff", { at: [x, 0.82, d / 2] });
    b.add(box(0.06, 1.25, 0.06), "#ffffff", { at: [x, 0.82, -d / 2] });
  }
  for (let i = 0; i <= 4; i++) {
    const z = -d / 2 + (i * d) / 4;
    b.add(box(0.06, 1.25, 0.06), "#ffffff", { at: [w / 2, 0.82, z] });
    b.add(box(0.06, 1.25, 0.06), "#ffffff", { at: [-w / 2, 0.82, z] });
  }
  // Glass gable roof with a white ridge.
  b.add(prism(w + 0.1, d + 0.1, 0.9), "#cfeefa", { at: [0, 1.42, 0] });
  b.add(box(w + 0.15, 0.07, 0.07), "#ffffff", { at: [0, 2.32, 0] });
  for (const [x, z] of [
    [-1, -0.5],
    [0.4, 0.4],
    [1.1, -0.6],
  ] as const) {
    b.add(ball(0.32, 1), HEDGE, { at: [x, 0.55, z] });
    b.add(gem(0.08), "#ff6fae", { at: [x + 0.1, 0.85, z] });
  }
  return { geometry: b.build(), height: 2.8 };
}

function throne(): DecorModel {
  const b = new MeshBuilder();
  b.add(box(1.5, 0.2, 1.5), "#7a2340", { at: [0, 0.1, 0] });
  b.add(box(0.9, 0.5, 0.9), GOLD_DARK, { at: [0, 0.45, 0] });
  b.add(box(0.85, 0.12, 0.85), "#3f9a46", { at: [0, 0.76, 0] });
  b.add(box(0.2, 1.2, 0.9), GOLD, { at: [-0.4, 1.2, 0] });
  for (const z of [-0.45, 0.45]) b.add(box(0.8, 0.3, 0.12), GOLD, { at: [0, 0.95, z] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    b.add(ball(0.13, 1), "#3fae49", {
      at: [-0.42, 1.95 + Math.sin(a) * 0.13, Math.cos(a) * 0.13],
      scale: [0.4, 1, 1],
    });
  }
  return { geometry: b.build(), height: 2.2 };
}

export const LARGE_DECOR_MODELS: Record<string, () => DecorModel> = {
  clover_statue: cloverStatue,
  moonlit_lantern_tree: lanternTree,
  topiary_swan: topiarySwan,
  rainbow_arch: rainbowArch,
  hedge_arch: hedgeArch,
  stargazer_scope: telescope,
  weathervane,
  bandstand,
  balloon_mooring: balloonMooring,
  glass_conservatory: conservatory,
  monarch_throne: throne,
};
