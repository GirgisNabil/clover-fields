import { getPlaceable } from "../catalog/registry";
import type { DomainError } from "../types/errors";
import type { ObjectId, Rotation } from "../types/ids";
import type { FarmObject, FarmState } from "../types/state";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Footprint at a rotation; odd rotations swap width and depth. Plots are 1×1. */
export function footprint(defId: string, rot: Rotation): { w: number; h: number } {
  if (defId === "plot") return { w: 1, h: 1 };
  const def = getPlaceable(defId);
  if (!def) throw new Error(`Unknown placeable ${defId}`);
  const [w, h] = def.footprint;
  return rot % 2 === 0 ? { w, h } : { w: h, h: w };
}

export function rectOf(obj: Pick<FarmObject, "defId" | "x" | "y" | "rot">): Rect {
  const { w, h } = footprint(obj.defId, obj.rot);
  return { x: obj.x, y: obj.y, w, h };
}

export function inBounds(rect: Rect, size: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= size && rect.y + rect.h <= size;
}

export interface Occupancy {
  size: number;
  /** Object id covering each tile, row-major (y * size + x). */
  cells: Array<ObjectId | null>;
}

const occupancyCache = new WeakMap<object, Occupancy>();

/**
 * Tile → object lookup, memoized per `objects` map (immer gives a new map on every change).
 * Animals roam, so they never occupy a tile: crops grow and buildings stand under their home.
 */
export function occupancy(state: Pick<FarmState, "objects" | "land">): Occupancy {
  const size = state.land.size;
  const cached = occupancyCache.get(state.objects);
  if (cached && cached.size === size) return cached;
  const cells: Array<ObjectId | null> = new Array(size * size).fill(null);
  for (const obj of Object.values(state.objects)) {
    if (obj.kind === "animal") continue;
    const r = rectOf(obj);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x >= 0 && y >= 0 && x < size && y < size) cells[y * size + x] = obj.id;
      }
    }
  }
  const result = { size, cells };
  occupancyCache.set(state.objects, result);
  return result;
}

export function objectAt(
  state: Pick<FarmState, "objects" | "land">,
  x: number,
  y: number,
): FarmObject | null {
  const { size, cells } = occupancy(state);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  const id = cells[y * size + x];
  return id ? (state.objects[id] ?? null) : null;
}

/** Why an item can't go at (x, y) with rotation `rot`, or null if it fits. */
export function canPlace(
  state: Pick<FarmState, "objects" | "land">,
  defId: string,
  x: number,
  y: number,
  rot: Rotation,
  ignoreId?: ObjectId,
): DomainError | null {
  const { w, h } = footprint(defId, rot);
  if (!inBounds({ x, y, w, h }, state.land.size)) return { code: "OUT_OF_BOUNDS" };
  const { size, cells } = occupancy(state);
  if (getPlaceable(defId)?.kind === "animal") {
    // An animal's home can be any open ground (grass, plots, paths), shared with other animals.
    const id = cells[y * size + x];
    const under = id && id !== ignoreId ? state.objects[id] : undefined;
    return under && !isOpenGround(under) ? { code: "OCCUPIED", by: under.id } : null;
  }
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const id = cells[ty * size + tx];
      if (id && id !== ignoreId) return { code: "OCCUPIED", by: id };
    }
  }
  return null;
}

/** Forget the memoized occupancy for an objects map (needed when mutating a draft in place). */
export function invalidateOccupancy(objects: object) {
  occupancyCache.delete(objects);
}

/** Ground an animal can stand on: plots and walkable decorations (stepping stones). */
function isOpenGround(obj: FarmObject): boolean {
  if (obj.kind === "plot") return true;
  return obj.kind === "decoration" && (getPlaceable(obj.defId)?.walkable ?? false);
}
