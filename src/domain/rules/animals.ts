import type { AnimalId } from "../catalog/animals";
import { FIELD_PULL, homeRoamers, MANURE_CHANCE, ROAM, WIDE_ROAMERS } from "../catalog/balance";
import { getBuilding, getCrop, getProducer } from "../catalog/registry";
import { DAY, HOUR, MINUTE } from "../constants";
import { hash32, toUnit } from "../rng/hash";
import type { Emit } from "../types/events";
import type { Ms, ObjectId, Tile } from "../types/ids";
import type { BuildingObject, FarmState, PlotObject } from "../types/state";
import { dayIndex } from "./day";
import { objectAt } from "./grid";
import { reachableTiles } from "./pasture";
import { cropStage } from "./time";
import { approachTiles } from "./walk";

// Roaming animals, deterministically. Time is cut into windows; in each daytime window every
// roaming animal "visits" one reachable tile picked by a hash. Settling replays the windows that
// finished since the last command, in a fixed order, and applies their manure. Nothing about
// movement is stored: the renderer animates toward the same tiles, but the rules never read it.

export const windowOf = (t: Ms) => Math.floor(t / ROAM.windowMs);
export const windowStart = (w: number): Ms => w * ROAM.windowMs;

/** Animals rest at home between restFromHour and restToHour, local time. */
export function isRestTime(t: Ms, offsetMin: number): boolean {
  const local = (((t + offsetMin * MINUTE) % DAY) + DAY) % DAY;
  const hour = Math.floor(local / HOUR);
  return hour >= ROAM.restFromHour || hour < ROAM.restToHour;
}

export interface Roamer {
  /** The animal object id, or the occupant id for housed animals. */
  id: string;
  defId: AnimalId;
  /** The free animal itself, or the building it lives in. */
  homeId: ObjectId;
  /** Where it rests. */
  home: Tile;
  starts: Tile[];
  radius: number;
}

const radiusOf = (defId: string) => (WIDE_ROAMERS.has(defId) ? ROAM.wideRadius : ROAM.radius);

/** Housing roles whose animals come out to roam (orchards hold trees; moths stay by their hut). */
const ROAMING_HOMES = new Set(["poultry", "barnyard", "stable"]);

function homeStarts(state: FarmState, building: BuildingObject): Tile[] {
  const size = state.land.size;
  return approachTiles(state, building).filter(
    (t) => t.x >= 0 && t.y >= 0 && t.x < size && t.y < size,
  );
}

/**
 * Every animal that roams on `day` (a local day index), sorted by id: free animals, plus a
 * hashed handful from each animal home (the rest stay inside that day).
 */
export function roamers(state: FarmState, day: number): Roamer[] {
  const list: Roamer[] = [];
  for (const obj of Object.values(state.objects)) {
    if (obj.kind === "animal") {
      // Moths flutter where they're put; only farm animals wander.
      if (getProducer(obj.defId)?.housing === "moth") continue;
      const home = { x: obj.x, y: obj.y };
      list.push({
        id: obj.id,
        defId: obj.defId,
        homeId: obj.id,
        home,
        starts: [home],
        radius: radiusOf(obj.defId),
      });
    } else if (obj.kind === "building") {
      const role = getBuilding(obj.defId)?.role;
      if (role?.type !== "housing" || !ROAMING_HOMES.has(role.accepts)) continue;
      const animals = obj.occupants.filter((o) => getProducer(o.defId)?.kind === "animal");
      if (animals.length === 0) continue;
      const starts = homeStarts(state, obj);
      const home = starts[0] ?? { x: obj.x, y: obj.y };
      const out = animals
        .map((o) => ({ o, k: hash32("out", obj.id, o.id, day) }))
        .sort((a, b) => a.k - b.k || (a.o.id < b.o.id ? -1 : 1))
        .slice(0, homeRoamers(obj.tier));
      for (const { o } of out) {
        list.push({
          id: o.id,
          defId: o.defId as AnimalId,
          homeId: obj.id,
          home,
          starts,
          radius: radiusOf(o.defId),
        });
      }
    }
  }
  return list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const weightedCache = new WeakMap<object, Map<string, Tile[]>>();

/** Reachable tiles with plots repeated FIELD_PULL times, so animals drift toward fields. */
function visitPool(state: FarmState, roamer: Roamer): Tile[] {
  let byKey = weightedCache.get(state.objects);
  if (!byKey) {
    byKey = new Map();
    weightedCache.set(state.objects, byKey);
  }
  const key = `${roamer.starts.map((t) => `${t.x},${t.y}`).join(";")}:${roamer.radius}`;
  const cached = byKey.get(key);
  if (cached) return cached;
  const pool: Tile[] = [];
  for (const tile of reachableTiles(state, roamer.starts, roamer.radius)) {
    const copies = objectAt(state, tile.x, tile.y)?.kind === "plot" ? FIELD_PULL : 1;
    for (let i = 0; i < copies; i++) pool.push(tile);
  }
  byKey.set(key, pool);
  return pool;
}

/** The tile a roamer visits in window `w`. */
export function visitTile(state: FarmState, roamer: Roamer, w: number): Tile {
  const pool = visitPool(state, roamer);
  if (pool.length === 0) return roamer.home;
  return pool[hash32("visit", roamer.id, w) % pool.length] ?? roamer.home;
}

/**
 * Where an animal is at `now` as far as the rules care: its visit tile by day, its home at night
 * (or when it stayed inside today). Null if no such animal.
 */
export function animalSpot(
  state: FarmState,
  id: string,
  now: Ms,
): { tile: Tile; resting: boolean } | null {
  const offset = state.meta.dayOffsetMin;
  const day = dayIndex(now, offset);
  const roamer = roamers(state, day).find((r) => r.id === id);
  if (roamer) {
    if (isRestTime(now, offset)) return { tile: roamer.home, resting: true };
    return { tile: visitTile(state, roamer, windowOf(now)), resting: false };
  }
  const obj = state.objects[id as ObjectId];
  if (obj?.kind === "animal") return { tile: { x: obj.x, y: obj.y }, resting: true };
  return null;
}

/** Leaves manure on a growing, unmanured crop. Returns true if it landed. */
function manure(draft: FarmState, tile: Tile, at: Ms, by: string, emit: Emit): boolean {
  const plot = objectAt(draft, tile.x, tile.y);
  if (plot?.kind !== "plot" || !plot.crop || plot.crop.manure) return false;
  if (plot.crop.plantedAt >= at || !getCrop(plot.crop.cropId)) return false;
  if (cropStage(plot.id, plot.crop, draft.meta.witherSalt, at).stage !== "growing") return false;
  const target = draft.objects[plot.id] as PlotObject;
  if (!target.crop) return false;
  target.crop.manure = { at, by };
  target.crop.fertilized = true;
  emit({ t: "manured", plotId: plot.id, at: { x: plot.x, y: plot.y }, by });
  return true;
}

/**
 * Applies every daytime window that finished since `animals.settledAt`: each roamer may drop
 * manure on the tile it visited. Runs before every command (see engine/observers.ts), so the
 * result never depends on how often commands happen.
 */
export function settleAnimals(draft: FarmState, emit: Emit, now: Ms) {
  const from = Math.max(windowOf(draft.animals.settledAt), windowOf(now - ROAM.catchUpMs));
  const to = windowOf(now);
  if (to <= from) return;
  const offset = draft.meta.dayOffsetMin;
  let day = Number.NaN;
  let list: Roamer[] = [];
  for (let w = from; w < to; w++) {
    const start = windowStart(w);
    if (isRestTime(start, offset)) continue;
    const d = dayIndex(start, offset);
    if (d !== day) {
      day = d;
      list = roamers(draft, day);
    }
    const end = windowStart(w + 1);
    for (const roamer of list) {
      const chance = MANURE_CHANCE[roamer.defId] ?? 0;
      if (toUnit(hash32("manure", roamer.id, w)) >= chance) continue;
      manure(draft, visitTile(draft, roamer, w), end, roamer.defId, emit);
    }
  }
  draft.animals.settledAt = Math.max(draft.animals.settledAt, windowStart(to));
}
