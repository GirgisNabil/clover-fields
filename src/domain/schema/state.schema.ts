import { z } from "zod";

const objectId = z.string().regex(/^o\d+$/);
const rotation = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const ms = z.number().finite();

const base = {
  id: objectId,
  x: z.number().int(),
  y: z.number().int(),
  rot: rotation,
  placedAt: ms,
};

const cropState = z.object({
  cropId: z.string(),
  plantedAt: ms,
  revivedAt: ms.nullable(),
  witherProof: z.boolean(),
  fertilized: z.boolean(),
  manure: z.object({ at: ms, by: z.string() }).nullable(),
});

const plot = z.object({
  ...base,
  kind: z.literal("plot"),
  defId: z.literal("plot"),
  soil: z.enum(["fallow", "plowed", "planted"]),
  crop: cropState.nullable(),
});

const animal = z.object({ ...base, kind: z.literal("animal"), defId: z.string(), cycleStart: ms });
const tree = z.object({ ...base, kind: z.literal("tree"), defId: z.string(), cycleStart: ms });

const building = z.object({
  ...base,
  kind: z.literal("building"),
  defId: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  occupants: z.array(z.object({ id: objectId, defId: z.string(), cycleStart: ms })),
  jobs: z.array(z.object({ recipeId: z.string(), startedAt: ms, readyAt: ms })),
});

const decoration = z.object({ ...base, kind: z.literal("decoration"), defId: z.string() });
const vehicle = z.object({
  ...base,
  kind: z.literal("vehicle"),
  defId: z.string(),
  tier: z.union([z.literal(1), z.literal(2)]),
});

const count = z.number().int().nonnegative();

/** Shape check for a saved farm. Def ids are checked against the catalog separately. */
export const FarmStateSchema = z.object({
  v: z.literal(3),
  meta: z.object({
    farmId: z.string().min(1),
    createdAt: ms,
    lastNow: ms,
    nextId: z.number().int().positive(),
    witherSalt: z.number().int(),
    dayOffsetMin: z
      .number()
      .int()
      .min(-24 * 60)
      .max(24 * 60),
  }),
  rng: z.object({ seed: z.number().int(), counter: count }),
  land: z.object({ size: z.number().int().min(12).max(26), expansionIndex: count }),
  wallet: z.object({ coins: count, clovers: count }),
  progress: z.object({ xp: count, level: z.number().int().min(1).max(50) }),
  objects: z.record(
    z.string(),
    z.discriminatedUnion("kind", [plot, animal, tree, building, decoration, vehicle]),
  ),
  inventory: z.object({ items: z.record(z.string(), count) }),
  mastery: z.record(
    z.string(),
    z.object({
      count,
      stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    }),
  ),
  stats: z.object({ counters: z.record(z.string(), z.number()) }),
  fuel: z.object({ units: count, anchor: ms }),
  materials: z.record(z.string(), count),
  collections: z.record(z.string(), z.object({ redeemed: count })),
  ribbons: z.record(z.string(), z.number().int().min(0).max(4)),
  quests: z.object({
    active: z.record(
      z.string(),
      z.object({ step: count, startedAt: ms, base: z.record(z.string(), z.number()) }),
    ),
    done: z.record(z.string(), ms),
  }),
  daily: z.object({
    lastClaimAt: ms.nullable(),
    streak: count,
    best: count,
    taskAt: ms.nullable(),
    tasks: z.array(z.object({ id: z.string(), base: z.number(), done: z.boolean() })),
  }),
  neighbors: z.record(
    z.string(),
    z.object({
      helpAt: ms.nullable(),
      helped: z.array(z.string()),
      giftAt: ms.nullable(),
      giftedAt: ms.nullable(),
      friendship: count,
    }),
  ),
  events: z.record(
    z.string(),
    z.object({ edition: z.number().int(), tokens: count, settled: z.boolean() }),
  ),
  animals: z.object({ settledAt: ms }),
});
