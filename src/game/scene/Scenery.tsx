"use client";

import { Suspense, useMemo } from "react";
import { MAX_FARM_SIZE } from "@/domain";
import type { ModelVisual } from "../assets/catalogVisuals";
import { seededRandom } from "../assets/procedural/builder";
import { ModelBoundary } from "../render/ModelBoundary";
import { ModelObject } from "../render/ModelObject";

type Prop = { visual: ModelVisual; weight: number; gap: number };

const prop = (
  model: ModelVisual["model"],
  fit: ModelVisual["fit"],
  weight: number,
  gap: number,
): Prop => ({
  visual: { model, fit },
  weight,
  gap,
});

/** Tall things for the back rows. */
const TREES: Prop[] = [
  prop("scenery_tree_round", { mode: "height", value: 2.7 }, 5, 1.7),
  prop("scenery_tree_tall", { mode: "height", value: 3.3 }, 4, 1.8),
  prop("scenery_pine", { mode: "height", value: 3.2 }, 3, 1.6),
  prop("scenery_pine_autumn", { mode: "height", value: 3.0 }, 2, 1.6),
];

/** Low things scattered nearer the farm and across the meadow. */
const UNDERGROWTH: Prop[] = [
  prop("scenery_bush", { mode: "length", value: 0.9 }, 6, 0.9),
  prop("scenery_bush_large", { mode: "length", value: 1.3 }, 4, 1.1),
  prop("scenery_rock", { mode: "length", value: 0.7 }, 3, 0.8),
  prop("scenery_rock_small", { mode: "length", value: 0.5 }, 3, 0.6),
  prop("scenery_flower", { mode: "length", value: 0.45 }, 5, 0.5),
  prop("scenery_mushroom", { mode: "height", value: 0.3 }, 2, 0.5),
  prop("scenery_stump", { mode: "length", value: 0.7 }, 2, 0.9),
  prop("scenery_log", { mode: "length", value: 1.4 }, 2, 1.3),
  prop("decor_haybale", { mode: "length", value: 0.9 }, 2, 1.1),
];

function pick(list: Prop[], rnd: () => number): Prop {
  const total = list.reduce((sum, p) => sum + p.weight, 0);
  let roll = rnd() * total;
  for (const candidate of list) {
    roll -= candidate.weight;
    if (roll < 0) return candidate;
  }
  return list[0] as Prop;
}

const ONE = { w: 1, h: 1 };

interface Placed {
  key: string;
  x: number;
  z: number;
  rot: number;
  visual: ModelVisual;
  gap: number;
}

/**
 * Trees, bushes, rocks and flowers around the farm: scenery only, never in the way. The back
 * edges (top of the screen) get a woodland band; the open meadow gets sparse undergrowth.
 * Nothing is placed where the farm can expand to.
 */
export function Scenery({ farmSize }: { farmSize: number }) {
  const props = useMemo(() => {
    const rnd = seededRandom(20261105);
    const result: Placed[] = [];
    const clear = (x: number, z: number, gap: number) =>
      !result.some((p) => Math.hypot(p.x - x, p.z - z) < (p.gap + gap) / 2) &&
      !(x > -1 && z > -1 && x < MAX_FARM_SIZE + 1 && z < MAX_FARM_SIZE + 1);
    const place = (list: Prop[], x: number, z: number, i: number) => {
      const chosen = pick(list, rnd);
      if (!clear(x, z, chosen.gap)) return;
      result.push({
        key: `p${i}`,
        x,
        z,
        rot: rnd() * Math.PI * 2,
        visual: chosen.visual,
        gap: chosen.gap,
      });
    };
    const span = MAX_FARM_SIZE + 10;
    // Woodland band behind the two back edges.
    for (let i = 0; i < 900 && result.length < 70; i++) {
      const along = -8 + rnd() * span;
      const depth = -1.8 - rnd() ** 1.6 * 9;
      const [x, z] = rnd() < 0.5 ? [along, depth] : [depth, along];
      place(depth < -3.5 || rnd() < 0.55 ? TREES : UNDERGROWTH, x, z, i);
    }
    // Undergrowth at the woodland edge and out on the meadow in front.
    for (let i = 0; i < 1200 && result.length < 150; i++) {
      const x = -10 + rnd() * (span + 12);
      const z = -10 + rnd() * (span + 12);
      place(rnd() < 0.12 ? TREES : UNDERGROWTH, x, z, 1000 + i);
    }
    return result;
  }, []);

  return (
    <>
      {props.map((p, i) => (
        <group key={p.key} position={[p.x, 0, p.z]} rotation-y={p.rot}>
          <ModelBoundary fallback={null}>
            <Suspense fallback={null}>
              <ModelObject visual={p.visual} footprint={ONE} seed={i} />
            </Suspense>
          </ModelBoundary>
        </group>
      ))}
      <group position={[-3.2, 0, farmSize - 1.5]}>
        <ModelBoundary fallback={null}>
          <Suspense fallback={null}>
            <ModelObject
              visual={{ model: "scenery_silo", fit: { mode: "height", value: 3.2 } }}
              footprint={ONE}
              seed={99}
            />
          </Suspense>
        </ModelBoundary>
      </group>
    </>
  );
}
