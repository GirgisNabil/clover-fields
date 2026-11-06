import { MeshBuilder, shade } from "./builder";
import type { ObjectModel } from "./objects";
import { box, cylinderUp, disc, prism } from "./shapes";

// Procedural farm vehicles, facing +x at rotation 0, sized to a 2×2 (combine 3×2) footprint.

const TIRE = "#2f2f2f";
const HUB = "#d9d4c7";

function wheel(b: MeshBuilder, x: number, z: number, r: number, width: number, hub = HUB) {
  b.add(disc(r, width, 10), TIRE, { at: [x, r, z], rot: [Math.PI / 2, 0, 0] });
  b.add(disc(r * 0.55, width + 0.01, 8), hub, { at: [x, r, z], rot: [Math.PI / 2, 0, 0] });
}

function tractorBase(b: MeshBuilder, body: string, scale = 1) {
  const s = scale;
  // Chassis and engine hood toward +x, cab toward -x.
  b.add(box(1.0 * s, 0.32 * s, 0.56 * s), body, { at: [0.12 * s, 0.5 * s, 0] });
  b.add(box(0.5 * s, 0.22 * s, 0.5 * s), shade(body, -0.12), { at: [0.45 * s, 0.75 * s, 0] });
  b.add(box(0.06 * s, 0.18 * s, 0.4 * s), "#bfc5c9", { at: [0.71 * s, 0.6 * s, 0] }); // grille
  b.add(cylinderUp(0.035 * s, 0.035 * s, 0.35 * s, 6), "#3a3a3a", {
    at: [0.5 * s, 0.86 * s, 0.14 * s],
  });
  // Cab with a roof.
  for (const z of [-0.26, 0.26]) {
    for (const x of [-0.42, -0.04]) {
      b.add(box(0.05 * s, 0.6 * s, 0.05 * s), "#3a3a3a", { at: [x * s, 0.95 * s, z * s] });
    }
  }
  b.add(box(0.56 * s, 0.06 * s, 0.66 * s), shade(body, 0.1), { at: [-0.23 * s, 1.27 * s, 0] });
  b.add(box(0.22 * s, 0.12 * s, 0.3 * s), "#5d4037", { at: [-0.25 * s, 0.72 * s, 0] }); // seat
  wheel(b, -0.3 * s, 0.38 * s, 0.38 * s, 0.2 * s);
  wheel(b, -0.3 * s, -0.38 * s, 0.38 * s, 0.2 * s);
  wheel(b, 0.5 * s, 0.33 * s, 0.22 * s, 0.14 * s);
  wheel(b, 0.5 * s, -0.33 * s, 0.22 * s, 0.14 * s);
}

function tractor(): ObjectModel {
  const b = new MeshBuilder();
  tractorBase(b, "#d0342c");
  // A small plow behind.
  b.add(box(0.12, 0.14, 0.7), "#8a8f93", { at: [-0.8, 0.22, 0] });
  return { geometry: b.build(), height: 1.35 };
}

function seeder(): ObjectModel {
  const b = new MeshBuilder();
  tractorBase(b, "#3c9b3f");
  // Seed hopper on the back.
  b.add(box(0.36, 0.34, 0.8), "#e9c25a", { at: [-0.78, 0.5, 0] });
  b.add(prism(0.36, 0.82, 0.18), "#d9a441", { at: [-0.78, 0.67, 0] });
  for (const z of [-0.3, 0, 0.3])
    b.add(cylinderUp(0.03, 0.03, 0.3, 6), "#6b4a2b", { at: [-0.78, 0.05, z] });
  return { geometry: b.build(), height: 1.35 };
}

function harvester(color: string, wide = false): ObjectModel {
  const b = new MeshBuilder();
  const w = wide ? 1.0 : 0.72;
  b.add(box(1.0, 0.7, w), color, { at: [-0.1, 0.72, 0] });
  b.add(box(0.45, 0.5, w * 0.7), shade(color, -0.1), { at: [-0.25, 1.32, 0] }); // cab
  b.add(box(0.36, 0.3, w * 0.66), "#bfe3f5", { at: [-0.08, 1.36, 0] }); // glass
  b.add(box(0.5, 0.06, w * 0.8), shade(color, 0.15), { at: [-0.25, 1.6, 0] });
  // Cutting reel at the front.
  b.add(box(0.3, 0.12, w + 0.5), "#8a8f93", { at: [0.62, 0.32, 0] });
  b.add(disc(0.16, w + 0.4, 6), "#e9c25a", { at: [0.62, 0.5, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(cylinderUp(0.05, 0.05, 0.6, 6), shade(color, -0.2), {
    at: [-0.5, 1.0, w * 0.4],
    rot: [0, 0, -0.5],
  });
  wheel(b, 0.25, w / 2 + 0.05, 0.36, 0.2);
  wheel(b, 0.25, -w / 2 - 0.05, 0.36, 0.2);
  wheel(b, -0.5, w / 2 + 0.02, 0.24, 0.16);
  wheel(b, -0.5, -w / 2 - 0.02, 0.24, 0.16);
  return { geometry: b.build(), height: 1.65 };
}

export const VEHICLE_MODELS: Record<string, () => ObjectModel> = {
  clodbuster_tractor: tractor,
  sprinkle_seeder: seeder,
  reapwell_harvester: () => harvester("#f2b632"),
  triplet_combine: () => harvester("#4f9b45", true),
};
