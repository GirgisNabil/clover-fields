import type { CropId } from "../catalog/crops";
import { HOUR, MINUTE, START_CLOVERS, START_COINS, START_SIZE } from "../constants";
import type { Ms, ObjectId } from "../types/ids";
import type { FarmObject, FarmState } from "../types/state";

export interface CreateFarmOptions {
  farmId: string;
  /** Hidden-outcome seed; pass crypto randomness from the caller. */
  seed: number;
  /** Public salt for wither moments; pass crypto randomness from the caller. */
  salt: number;
  now: Ms;
  /** Minutes to add to UTC for the player's local day (e.g. -new Date().getTimezoneOffset()). */
  dayOffsetMin?: number;
}

/** A starter farm that teaches the loop: ripe crops, ready producers, an item to place. */
export function createFarm({
  farmId,
  seed,
  salt,
  now,
  dayOffsetMin = 0,
}: CreateFarmOptions): FarmState {
  let nextId = 1;
  const objects: Record<ObjectId, FarmObject> = {};
  const add = (make: (id: ObjectId) => FarmObject) => {
    const id: ObjectId = `o${nextId++}`;
    objects[id] = make(id);
  };
  const base = (id: ObjectId, x: number, y: number) => ({
    id,
    x,
    y,
    rot: 0 as const,
    placedAt: now,
  });

  add((id) => ({
    ...base(id, 9, 0),
    kind: "building",
    defId: "tool_shed",
    tier: 1,
    occupants: [],
    jobs: [],
  }));
  for (let x = 2; x <= 5; x++) {
    add((id) => ({
      ...base(id, x, 4),
      kind: "plot",
      defId: "plot",
      soil: "planted",
      crop: {
        cropId: "clover_sprout" satisfies CropId,
        plantedAt: now - 2 * MINUTE,
        revivedAt: null,
        witherProof: true,
        fertilized: false,
        manure: null,
      },
    }));
  }
  for (let x = 2; x <= 5; x++) {
    add((id) => ({ ...base(id, x, 5), kind: "plot", defId: "plot", soil: "plowed", crop: null }));
  }
  add((id) => ({
    ...base(id, 8, 5),
    kind: "tree",
    defId: "rosy_apple",
    cycleStart: now - 6 * HOUR,
  }));
  add((id) => ({
    ...base(id, 8, 7),
    kind: "animal",
    defId: "russet_hen",
    cycleStart: now - 1 * HOUR,
  }));
  add((id) => ({ ...base(id, 1, 4), kind: "decoration", defId: "straw_sentinel" }));
  for (let x = 2; x <= 7; x++) {
    add((id) => ({ ...base(id, x, 7), kind: "decoration", defId: "rail_fence" }));
  }

  return {
    v: 3,
    meta: { farmId, createdAt: now, lastNow: now, nextId, witherSalt: salt >>> 0, dayOffsetMin },
    rng: { seed: seed >>> 0, counter: 0 },
    land: { size: START_SIZE, expansionIndex: 0 },
    wallet: { coins: START_COINS, clovers: START_CLOVERS },
    progress: { xp: 0, level: 1 },
    objects,
    inventory: { items: { daisy_bed: 1, unwither_tonic: 1 } },
    mastery: {},
    stats: { counters: {} },
    fuel: { units: 0, anchor: now },
    materials: {},
    collections: {},
    ribbons: {},
    // The welcome tutorial starts right away (see catalog/quests.ts).
    quests: { active: { welcome: { step: 0, startedAt: now, base: {} } }, done: {} },
    daily: { lastClaimAt: null, streak: 0, best: 0, taskAt: null, tasks: [] },
    neighbors: {},
    events: {},
    animals: { settledAt: now },
  };
}
