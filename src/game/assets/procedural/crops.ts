import type { BufferGeometry } from "three";
import type { CropDef, CropLook, CropShape } from "@/domain";
import { MeshBuilder, mix, seededRandom, shade, stringSeed } from "./builder";
import { ball, box, coneUp, disc, gem, rodUp } from "./shapes";

/** Growth visuals 0–3, then the ripe model. Withered crops reuse visual 3 with a tint. */
export type CropVisual = 0 | 1 | 2 | 3 | "ripe";

const SPROUT = "#71c84d";
const STEM = "#4f8f2f";

interface PlantContext {
  b: MeshBuilder;
  look: CropLook;
  id: string;
  /** Growth from about 0.45 (young) to 1 (ripe). */
  g: number;
  ripe: boolean;
  rnd: () => number;
}

type Spot = [number, number];

function spots(kind: "grid3" | "grid2", rnd: () => number): Spot[] {
  const offsets = kind === "grid3" ? [-0.27, 0, 0.27] : [-0.18, 0.18];
  const result: Spot[] = [];
  for (const x of offsets) {
    for (const z of offsets) result.push([x + (rnd() - 0.5) * 0.06, z + (rnd() - 0.5) * 0.06]);
  }
  return result;
}

function sprouts({ b, rnd }: Pick<PlantContext, "b" | "rnd">) {
  for (const [x, z] of spots("grid2", rnd)) {
    const turn = rnd() * Math.PI;
    for (const side of [-1, 1]) {
      b.add(gem(0.05), SPROUT, {
        at: [x + Math.cos(turn) * 0.025 * side, 0.035, z + Math.sin(turn) * 0.025 * side],
        rot: [0, turn, 0.5 * side],
        scale: [1, 0.35, 0.6],
      });
    }
  }
}

const SHAPES: Record<CropShape, (ctx: PlantContext) => void> = {
  sprig({ b, look, g, ripe, rnd }) {
    const s = 0.6 + 0.7 * g;
    for (const [x, z] of spots("grid3", rnd)) {
      const h = 0.04 + 0.06 * g;
      const turn = rnd() * Math.PI * 2;
      b.add(rodUp(0.008, h), STEM, { at: [x, 0, z] });
      for (let i = 0; i < 3; i++) {
        const a = turn + (i * Math.PI * 2) / 3;
        b.add(gem(0.055 * s), shade(look.color, (rnd() - 0.5) * 0.15), {
          at: [x + Math.cos(a) * 0.045 * s, h, z + Math.sin(a) * 0.045 * s],
          scale: [1, 0.35, 1],
        });
      }
      if (ripe && rnd() > 0.3) b.add(gem(0.028), look.accent, { at: [x, h + 0.04, z] });
    }
  },

  bush({ b, look, g, ripe, rnd }) {
    const r = 0.1 * g + 0.035;
    for (const [x, z] of spots("grid2", rnd)) {
      b.add(ball(r), shade(look.color, (rnd() - 0.5) * 0.12), { at: [x, r * 0.9, z] });
      b.add(ball(r * 0.75), shade(look.color, 0.08), {
        at: [x + (rnd() - 0.5) * r, r * 1.35, z + (rnd() - 0.5) * r],
      });
      if (!ripe) continue;
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2;
        const e = 0.15 + rnd() * 0.9;
        b.add(gem(0.042), look.accent, {
          at: [
            x + Math.cos(e) * Math.cos(a) * r,
            r * 0.9 + Math.sin(e) * r,
            z + Math.cos(e) * Math.sin(a) * r,
          ],
        });
      }
    }
  },

  root({ b, look, g, ripe, rnd }) {
    for (const [x, z] of spots("grid3", rnd)) {
      const turn = rnd() * Math.PI;
      for (let i = 0; i < 3; i++) {
        const a = turn + (i * Math.PI * 2) / 3;
        b.add(coneUp(0.028, 0.08 + 0.16 * g), shade(look.color, (rnd() - 0.5) * 0.1), {
          at: [x, 0, z],
          rot: [0.35, a, 0],
          order: "YXZ",
        });
      }
      if (ripe) b.add(ball(0.07), look.accent, { at: [x, 0.03, z], scale: [1, 0.8, 1] });
    }
  },

  grain({ b, look, g, ripe, rnd }) {
    const stalkColor = ripe ? mix(look.color, look.accent, 0.65) : look.color;
    const h = 0.1 + 0.3 * g;
    for (const [x, z] of spots("grid3", rnd)) {
      for (let i = 0; i < 2; i++) {
        const lean: [number, number, number] = [(rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25];
        const ox = x + (i - 0.5) * 0.04;
        b.add(rodUp(0.014, h), stalkColor, { at: [ox, 0, z], rot: lean });
        if (ripe || g > 0.85) {
          b.add(gem(0.034), ripe ? look.accent : shade(look.color, 0.15), {
            at: [ox + lean[2] * -h * 0.9, h + 0.02, z + lean[0] * h * 0.9],
            scale: [0.8, 2.1, 0.8],
          });
        }
      }
    }
  },

  stalk({ b, look, g, ripe, rnd }) {
    const h = 0.15 + 0.5 * g;
    for (const [x, z] of spots("grid2", rnd)) {
      b.add(rodUp(0.022, h), STEM, { at: [x, 0, z] });
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2;
        b.add(box(0.012, 0.2 * g + 0.05, 0.05), shade(look.color, (rnd() - 0.5) * 0.1), {
          at: [x + Math.cos(a) * 0.03, h * (0.3 + i * 0.22), z + Math.sin(a) * 0.03],
          rot: [0.6, a, 0],
          order: "YXZ",
        });
      }
      if (ripe) {
        for (const side of [-1, 1]) {
          b.add(ball(0.04), look.accent, {
            at: [x + side * 0.045, h * 0.55, z + side * 0.02],
            rot: [0, 0, side * 0.4],
            scale: [0.8, 2.2, 0.8],
          });
        }
      }
    }
  },

  tallflower({ b, look, g, ripe, rnd }) {
    const h = 0.15 + 0.55 * g;
    const tilt = 0.9;
    const nx = Math.SQRT1_2 * Math.sin(tilt);
    const ny = Math.cos(tilt);
    const nz = Math.SQRT1_2 * Math.sin(tilt);
    for (const [x, z] of spots("grid2", rnd)) {
      b.add(rodUp(0.02, h), STEM, { at: [x, 0, z] });
      for (const side of [-1, 1]) {
        b.add(ball(0.05 * g + 0.02), look.color, {
          at: [x + side * 0.05, h * 0.45, z - side * 0.03],
          scale: [1.4, 0.35, 0.8],
          rot: [0, side * 0.8, 0],
        });
      }
      const head = ripe ? 0.11 : 0.05 * g;
      b.add(disc(head, 0.025), ripe ? look.accent : look.color, {
        at: [x, h, z],
        rot: [tilt, Math.PI / 4, 0],
        order: "YXZ",
      });
      if (ripe)
        b.add(gem(0.05), "#6b3e1e", {
          at: [x + nx * 0.015, h + ny * 0.015, z + nz * 0.015],
          scale: [1, 0.4, 1],
        });
    }
  },

  vine({ b, look, g, ripe, rnd }) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
      const d = 0.12 + rnd() * 0.16;
      b.add(ball(0.06 + 0.06 * g), shade(look.color, (rnd() - 0.5) * 0.15), {
        at: [Math.cos(a) * d, 0.04, Math.sin(a) * d],
        scale: [1, 0.35, 1],
      });
    }
    if (!ripe) return;
    const melon = look.accent.toLowerCase() === "#58b347";
    for (const [x, z] of [
      [-0.15, 0.12],
      [0.15, -0.13],
    ] as const) {
      const shape: [number, number, number] = melon ? [1.3, 0.85, 1] : [1.05, 0.8, 1.05];
      b.add(ball(0.16, 1), melon ? "#7cc95a" : look.accent, { at: [x, 0.13, z], scale: shape });
      if (melon) {
        for (const stripe of [-0.06, 0.06]) {
          b.add(ball(0.162, 1), "#3f8f3a", {
            at: [x, 0.13, z + stripe],
            scale: [shape[0] * 1.01, shape[1] * 1.01, 0.18],
          });
        }
      }
      b.add(rodUp(0.016, 0.06), melon ? STEM : "#6b4a2b", { at: [x, 0.25, z] });
    }
  },

  pod({ b, look, id, g, ripe, rnd }) {
    const big = id.includes("eggplant");
    const r = 0.08 * g + 0.03;
    for (const [x, z] of spots("grid2", rnd)) {
      b.add(ball(r), shade(look.color, (rnd() - 0.5) * 0.12), { at: [x, r, z] });
      b.add(ball(r * 0.8), look.color, { at: [x + 0.02, r * 1.7, z - 0.02] });
      if (!ripe) continue;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + rnd();
        b.add(gem(big ? 0.06 : 0.045), look.accent, {
          at: [x + Math.cos(a) * r * 1.05, r * 0.8, z + Math.sin(a) * r * 1.05],
          rot: [0, 0, (rnd() - 0.5) * 0.6],
          scale: [0.8, 2, 0.8],
        });
      }
    }
  },

  leafy({ b, look, g, ripe, rnd }) {
    for (const [x, z] of spots("grid2", rnd)) {
      const turn = rnd() * Math.PI;
      for (let i = 0; i < 5; i++) {
        const a = turn + (i / 5) * Math.PI * 2;
        b.add(gem(0.07 * g + 0.02), shade(look.color, (rnd() - 0.5) * 0.12), {
          at: [x + Math.cos(a) * 0.06, 0.05, z + Math.sin(a) * 0.06],
          rot: [0.5, a, 0],
          order: "YXZ",
          scale: [1.2, 0.4, 1],
        });
      }
      b.add(ball(ripe ? 0.115 : 0.06 * g), ripe ? look.accent : shade(look.color, 0.2), {
        at: [x, ripe ? 0.1 : 0.05, z],
        scale: [1, 0.85, 1],
      });
    }
  },

  spiky({ b, look, g, ripe, rnd }) {
    for (const [x, z] of spots("grid2", rnd)) {
      const turn = rnd() * Math.PI;
      for (let i = 0; i < 7; i++) {
        const a = turn + (i / 7) * Math.PI * 2;
        b.add(coneUp(0.022, 0.08 + 0.16 * g), shade(look.color, (rnd() - 0.5) * 0.12), {
          at: [x, 0, z],
          rot: [0.85, a, 0],
          order: "YXZ",
        });
      }
      if (!ripe) continue;
      b.add(ball(0.085), look.accent, { at: [x, 0.14, z], scale: [1, 1.45, 1] });
      for (let i = 0; i < 4; i++) {
        b.add(coneUp(0.012, 0.07), STEM, {
          at: [x, 0.2, z],
          rot: [0.3, (i / 4) * Math.PI * 2, 0],
          order: "YXZ",
        });
      }
    }
  },

  flower({ b, look, id, g, ripe, rnd }) {
    const palette = id.includes("rainbow")
      ? ["#ff6fae", "#ffd23f", "#ff7b39", "#b56cff", "#ff4f5e"]
      : [look.accent];
    const lotus = id.includes("lotus");
    const h = lotus ? 0.08 + 0.06 * g : 0.08 + 0.18 * g;
    spots("grid3", rnd).forEach(([x, z], i) => {
      b.add(rodUp(0.011, h), STEM, { at: [x, 0, z] });
      b.add(gem(0.04 * g + 0.015), look.color, {
        at: [x + 0.02, h * 0.4, z],
        scale: [1.6, 0.35, 0.8],
        rot: [0, rnd() * 3, 0],
      });
      const color = palette[i % palette.length] ?? look.accent;
      if (ripe) {
        if (lotus) {
          b.add(ball(0.07), color, { at: [x, h, z], scale: [1.4, 0.55, 1.4] });
          b.add(gem(0.02), "#ffe58a", { at: [x, h + 0.025, z] });
        } else {
          b.add(coneUp(0.065, 0.085, 6).rotateX(Math.PI).translate(0, 0.085, 0), color, {
            at: [x, h - 0.01, z],
          });
          b.add(gem(0.03), shade(color, 0.3), { at: [x, h + 0.06, z] });
        }
      } else if (g > 0.6) {
        b.add(gem(0.018), shade(look.color, 0.25), { at: [x, h + 0.01, z], scale: [1, 1.6, 1] });
      }
    });
  },
};

/** Builds the merged geometry for one crop at one visual stage. */
export function buildCropGeometry(crop: CropDef, visual: CropVisual): BufferGeometry {
  const b = new MeshBuilder();
  const rnd = seededRandom(stringSeed(`${crop.id}:${visual}`));
  if (visual === 0) {
    sprouts({ b, rnd });
  } else {
    const g = visual === "ripe" ? 1 : ([0, 0.45, 0.7, 0.9] as const)[visual];
    SHAPES[crop.look.shape]({ b, look: crop.look, id: crop.id, g, ripe: visual === "ripe", rnd });
  }
  return b.build();
}
