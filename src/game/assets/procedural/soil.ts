import { type BufferGeometry, CylinderGeometry } from "three";
import { MeshBuilder, seededRandom, shade } from "./builder";
import { box, gem } from "./shapes";

/** Height of the soil surface; crops stand on it. */
export const SOIL_TOP = 0.07;

const BED = "#5e3b22";
const BED_EDGE = "#4f311c";
const RIDGE = "#6f4628";

/** A soft, rounded furrow ridge running along x. */
function ridge(length: number, radius: number) {
  return new CylinderGeometry(radius, radius, length, 12, 1).rotateZ(Math.PI / 2);
}

/** A tilled bed: a slightly bevelled base with four rounded furrows. */
export function buildPlowedSoil(): BufferGeometry {
  const b = new MeshBuilder();
  b.add(box(0.94, SOIL_TOP * 0.55, 0.94), BED_EDGE, { at: [0, (SOIL_TOP * 0.55) / 2, 0] });
  b.add(box(0.88, SOIL_TOP * 0.45, 0.88), BED, {
    at: [0, SOIL_TOP * 0.55 + (SOIL_TOP * 0.45) / 2, 0],
  });
  for (const z of [-0.315, -0.105, 0.105, 0.315]) {
    b.add(ridge(0.84, 0.085), RIDGE, { at: [0, SOIL_TOP - 0.025, z], scale: [1, 0.5, 1] });
  }
  // Little clods break up the straight lines.
  const rnd = seededRandom(7);
  for (let i = 0; i < 14; i++) {
    const z = [-0.315, -0.105, 0.105, 0.315][i % 4] ?? 0;
    b.add(gem(0.022 + rnd() * 0.015), shade(RIDGE, (rnd() - 0.5) * 0.25), {
      at: [-0.38 + rnd() * 0.76, SOIL_TOP + 0.012, z + (rnd() - 0.5) * 0.12],
      rot: [rnd() * 3, rnd() * 3, 0],
      scale: [1, 0.6, 1],
    });
  }
  return b.build();
}

/** Untilled earth: a low, lighter mound waiting for the plow. */
export function buildFallowSoil(): BufferGeometry {
  const b = new MeshBuilder();
  b.add(box(0.92, SOIL_TOP * 0.5, 0.92), "#8d6a42", { at: [0, (SOIL_TOP * 0.5) / 2, 0] });
  b.add(box(0.84, SOIL_TOP * 0.3, 0.84), "#a07b4e", {
    at: [0, SOIL_TOP * 0.5 + (SOIL_TOP * 0.3) / 2, 0],
  });
  return b.build();
}

/** A small cartoon manure pile with a golden sparkle, set on a plot's corner. */
export function buildManurePile(): BufferGeometry {
  const b = new MeshBuilder();
  const brown = "#6b4423";
  b.add(gem(0.07), brown, { at: [0, 0.03, 0], scale: [1.2, 0.55, 1.2] });
  b.add(gem(0.05), shade(brown, 0.08), { at: [0.005, 0.07, 0], scale: [1.1, 0.6, 1.1] });
  b.add(gem(0.03), shade(brown, 0.15), { at: [0.01, 0.1, 0], scale: [1, 0.8, 1] });
  // Sparkle: two crossed flat diamonds above the pile.
  for (const turn of [0, Math.PI / 2]) {
    b.add(gem(0.035), "#ffd84a", { at: [0.05, 0.19, 0], rot: [0, turn, 0], scale: [0.25, 1, 1] });
  }
  return b.build();
}
