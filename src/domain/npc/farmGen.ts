import type { CropId } from "../catalog/crops";
import { getNeighbor } from "../catalog/neighbors";
import { getBuilding, getCrop, getProducer } from "../catalog/registry";
import { hash32 } from "../rng/hash";
import { cropStage, producerStatus } from "../rules/time";
import { createFarm } from "../setup/createFarm";
import type { Ms, ObjectId } from "../types/ids";
import type { FarmObject, FarmState } from "../types/state";

// A neighbour's farm, rebuilt from (neighbour, day): never stored. Tiles you already helped
// with today (`helped`, "x,y" keys) are shown as done: crops harvested, animals collected.

const SIZE = 14;

/** A small seeded generator (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const tileKey = (x: number, y: number) => `${x},${y}`;

export function neighborFarm(
  id: string,
  day: number,
  helped: readonly string[],
  now: Ms,
): FarmState {
  const def = getNeighbor(id);
  const base = createFarm({ farmId: `npc-${id}`, seed: hash32("npc", id), salt: 7, now });
  if (!def) return base;
  const rnd = seeded(hash32("npc-day", id, day));
  const done = new Set(helped);
  const objects: Record<ObjectId, FarmObject> = {};
  let next = 1;
  const add = (make: (id: ObjectId) => FarmObject) => {
    const oid: ObjectId = `o${next++}`;
    objects[oid] = make(oid);
  };
  const at = (x: number, y: number) => ({ x, y, rot: 0 as const, placedAt: now });

  // The neighbour's signature building in the back corner.
  const building = getBuilding(def.building);
  const [bw] = building?.footprint ?? [3, 3];
  add((oid) => ({
    ...at(SIZE - bw, 0),
    id: oid,
    kind: "building",
    defId: def.building as never,
    tier: 2,
    occupants: [],
    jobs: [],
  }));

  // A 6×4 field of their favourite crop: some ripe (chores), the rest at various stages.
  const crop = getCrop(def.crop);
  const growMs = crop?.growMs ?? 60_000;
  let ripe = 0;
  for (let y = 1; y <= 4; y++) {
    for (let x = 1; x <= 6; x++) {
      const helpedHere = done.has(tileKey(x, y));
      const isRipe = ripe < 6 || rnd() < 0.3;
      if (isRipe) ripe++;
      const progress = isRipe ? 1.05 : 0.1 + rnd() * 0.8;
      add((oid) => ({
        ...at(x, y),
        id: oid,
        kind: "plot",
        defId: "plot",
        soil: helpedHere ? "plowed" : "planted",
        crop: helpedHere
          ? null
          : {
              cropId: def.crop as CropId,
              plantedAt: Math.round(now - growMs * progress),
              revivedAt: null,
              witherProof: true,
              fertilized: false,
              manure: null,
            },
      }));
    }
  }

  // A fence along the field, fruit trees behind it and a few animals beyond.
  for (let x = 0; x <= 7; x++)
    add((oid) => ({ ...at(x, 6), id: oid, kind: "decoration", defId: "rail_fence" }));
  const tree = getProducer(def.tree);
  for (const x of [1, 3, 5]) {
    const ready = !done.has(tileKey(x, 8)) && rnd() < 0.7;
    add((oid) => ({
      ...at(x, 8),
      id: oid,
      kind: "tree",
      defId: def.tree as never,
      cycleStart: now - (tree?.cycleMs ?? 3_600_000) * (ready ? 1.1 : 0.4),
    }));
  }
  const animal = getProducer(def.animal);
  for (const [x, y] of [
    [2, 11],
    [5, 12],
    [7, 10],
    [3, 13],
  ] as const) {
    const ready = !done.has(tileKey(x, y)) && rnd() < 0.6;
    add((oid) => ({
      ...at(x, y),
      id: oid,
      kind: "animal",
      defId: def.animal as never,
      cycleStart: now - (animal?.cycleMs ?? 3_600_000) * (ready ? 1.1 : 0.3),
    }));
  }

  // Their favourite decorations.
  const spots: Array<[number, number]> = [
    [10, 6],
    [11, 10],
    [8, 12],
  ];
  def.decor.forEach((decor, i) => {
    const spot = spots[i];
    if (spot)
      add((oid) => ({ ...at(spot[0], spot[1]), id: oid, kind: "decoration", defId: decor }));
  });

  return {
    ...base,
    land: { size: SIZE, expansionIndex: 1 },
    objects,
    meta: { ...base.meta, nextId: next, lastNow: now },
    animals: { settledAt: now },
    quests: { active: {}, done: {} },
  };
}

export interface HelpTarget {
  x: number;
  y: number;
  kind: "crop" | "animal" | "tree";
  /** For collectible finds. */
  shape?: string;
}

/** Chores on a neighbour's farm: ripe crops to harvest and producers ready to collect. */
export function helpTargets(farm: FarmState, now: Ms): HelpTarget[] {
  const out: HelpTarget[] = [];
  for (const obj of Object.values(farm.objects)) {
    if (obj.kind === "plot" && obj.crop) {
      if (cropStage(obj.id, obj.crop, farm.meta.witherSalt, now).stage === "ripe") {
        const shape = getCrop(obj.crop.cropId)?.look.shape;
        out.push(
          shape
            ? { x: obj.x, y: obj.y, kind: "crop", shape }
            : { x: obj.x, y: obj.y, kind: "crop" },
        );
      }
    } else if (obj.kind === "animal" || obj.kind === "tree") {
      const def = getProducer(obj.defId);
      if (def && producerStatus(obj.cycleStart, def.cycleMs, now).ready) {
        out.push({ x: obj.x, y: obj.y, kind: obj.kind });
      }
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}
