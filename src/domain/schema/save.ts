import {
  getConsumable,
  getCrop,
  getMaterial,
  getPlaceable,
  getProducer,
} from "../catalog/registry";
import type { Ms, ObjectId } from "../types/ids";
import type { FarmState } from "../types/state";
import { FarmStateSchema } from "./state.schema";

export const SAVE_FORMAT = "clover-fields";
export const CURRENT_VERSION = 3;

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  v: number;
  /** Increases by one per committed command; the highest rev wins on load. */
  rev: number;
  savedAt: Ms;
  farmId: string;
  state: unknown;
}

export function makeEnvelope(state: FarmState, rev: number, savedAt: Ms): SaveEnvelope {
  return {
    format: SAVE_FORMAT,
    v: CURRENT_VERSION,
    rev,
    savedAt,
    farmId: state.meta.farmId,
    state,
  };
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

// biome-ignore lint/suspicious/noExplicitAny: migrations read untyped JSON from older saves
type Raw = Record<string, any>;

const mapValues = (record: Raw, fn: (value: Raw) => Raw): Raw =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fn(v as Raw)]));

/** v1 → v2: adds the crafting, collection, ribbon, quest, daily, neighbor and event slices. */
function migrateV1(s: Raw): Raw {
  const counters: Record<string, number> = { ...(s.stats?.counters ?? {}) };
  // Collect counters are new; rebuild them from the per-item harvest counters.
  let animal = 0;
  let tree = 0;
  for (const [key, value] of Object.entries(counters)) {
    const id = key.startsWith("harvest:") ? key.slice(8) : "";
    if (getProducer(id)?.kind === "animal") animal += value;
    if (getProducer(id)?.kind === "tree") tree += value;
  }
  if (animal) counters["collect:animal"] = animal;
  if (tree) counters["collect:tree"] = tree;
  return {
    ...s,
    meta: { ...s.meta, dayOffsetMin: 0 },
    fuel: { units: s.fuel?.units ?? 0, anchor: s.meta.lastNow },
    objects: mapValues(s.objects ?? {}, (o) =>
      o.kind === "plot" && o.crop
        ? { ...o, crop: { ...o.crop, fertilized: false } }
        : o.kind === "building"
          ? { ...o, jobs: [] }
          : o,
    ),
    stats: { counters },
    materials: {},
    collections: {},
    ribbons: {},
    quests: { active: {}, done: {} },
    daily: { lastClaimAt: null, streak: 0, best: 0, taskAt: null, tasks: [] },
    neighbors: {},
    events: {},
  };
}

/** v2 → v3: roaming animals (settle clock) and manure on crops. */
function migrateV2(s: Raw): Raw {
  return {
    ...s,
    objects: mapValues(s.objects ?? {}, (o) =>
      o.kind === "plot" && o.crop ? { ...o, crop: { ...o.crop, manure: null } } : o,
    ),
    animals: { settledAt: s.meta.lastNow },
  };
}

/** migrations[v] upgrades a v-state to v + 1. Add one per schema change, with a fixture test. */
const MIGRATIONS: Record<number, Migration> = { 1: migrateV1, 2: migrateV2 };

export type LoadResult =
  | { ok: true; state: FarmState; rev: number; notes: string[] }
  | { ok: false; reason: "not-a-save" | "too-new" | "invalid"; detail?: string };

export function loadEnvelope(raw: unknown): LoadResult {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not-a-save" };
  const envelope = raw as Partial<SaveEnvelope>;
  if (envelope.format !== SAVE_FORMAT || typeof envelope.v !== "number") {
    return { ok: false, reason: "not-a-save" };
  }
  if (envelope.v > CURRENT_VERSION) return { ok: false, reason: "too-new" };
  let state = envelope.state as Record<string, unknown>;
  for (let v = envelope.v; v < CURRENT_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { ok: false, reason: "invalid", detail: `no migration from v${v}` };
    state = { ...migrate(state), v: v + 1 };
  }
  const parsed = FarmStateSchema.safeParse(state);
  if (!parsed.success) return { ok: false, reason: "invalid", detail: parsed.error.message };
  const { state: clean, notes } = sanitizeCatalog(parsed.data as unknown as FarmState);
  return { ok: true, state: clean, rev: envelope.rev ?? 0, notes };
}

/** Removes anything the current catalog no longer knows, so old saves always load. */
export function sanitizeCatalog(state: FarmState): { state: FarmState; notes: string[] } {
  const notes: string[] = [];
  const objects = { ...state.objects };
  for (const [id, obj] of Object.entries(objects) as Array<
    [ObjectId, (typeof objects)[ObjectId]]
  >) {
    if (!obj) continue;
    if (obj.kind === "plot") {
      if (obj.crop && !getCrop(obj.crop.cropId)) {
        notes.push(`Unknown crop ${obj.crop.cropId} cleared`);
        objects[id] = { ...obj, soil: "plowed", crop: null };
      }
    } else if (!getPlaceable(obj.defId)) {
      notes.push(`Unknown item ${obj.defId} removed`);
      delete objects[id];
    } else if (obj.kind === "building") {
      const occupants = obj.occupants.filter((o) => getPlaceable(o.defId));
      if (occupants.length !== obj.occupants.length) {
        notes.push(`Unknown occupants removed from ${obj.defId}`);
        objects[id] = { ...obj, occupants };
      }
    }
  }
  const items: Record<string, number> = {};
  for (const [defId, n] of Object.entries(state.inventory.items)) {
    if (getPlaceable(defId) || getConsumable(defId)) items[defId] = n;
    else notes.push(`Unknown stored item ${defId} removed`);
  }
  const materials: Record<string, number> = {};
  for (const [id, n] of Object.entries(state.materials)) {
    if (getMaterial(id)) materials[id] = n;
    else notes.push(`Unknown material ${id} removed`);
  }
  return { state: { ...state, objects, inventory: { items }, materials }, notes };
}
