import { getPlaceable } from "../catalog/registry";
import type { Tile } from "../types/ids";
import type { FarmObject, FarmState } from "../types/state";
import { rectOf } from "./grid";

/**
 * Walkability over the farm plus a one-tile ring around it, so the farmer can walk the edge.
 * Cell (x, y) lives at index (y + 1) * stride + (x + 1), with x and y in [-1, size].
 */
export interface WalkGrid {
  size: number;
  stride: number;
  cells: Uint8Array;
}

export function isWalkableObject(obj: FarmObject): boolean {
  if (obj.kind === "plot" || obj.kind === "animal") return true;
  if (obj.kind === "decoration") return getPlaceable(obj.defId)?.walkable ?? false;
  return false;
}

const walkCache = new WeakMap<object, WalkGrid>();

export function walkableGrid(state: Pick<FarmState, "objects" | "land">): WalkGrid {
  const size = state.land.size;
  const cached = walkCache.get(state.objects);
  if (cached && cached.size === size) return cached;
  const stride = size + 2;
  const cells = new Uint8Array(stride * stride).fill(1);
  for (const obj of Object.values(state.objects)) {
    if (isWalkableObject(obj)) continue;
    const r = rectOf(obj);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) cells[(y + 1) * stride + (x + 1)] = 0;
    }
  }
  const grid = { size, stride, cells };
  walkCache.set(state.objects, grid);
  return grid;
}

export function isWalkable(grid: WalkGrid, x: number, y: number): boolean {
  if (x < -1 || y < -1 || x > grid.size || y > grid.size) return false;
  return grid.cells[(y + 1) * grid.stride + (x + 1)] === 1;
}

/** Walkable tiles in the ring around an object's footprint, nearest sides first. */
export function approachTiles(state: Pick<FarmState, "objects" | "land">, obj: FarmObject): Tile[] {
  const grid = walkableGrid(state);
  const r = rectOf(obj);
  const sides: Tile[] = [];
  const corners: Tile[] = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      const insideX = x >= r.x && x < r.x + r.w;
      const insideY = y >= r.y && y < r.y + r.h;
      if (insideX && insideY) continue;
      if (!isWalkable(grid, x, y)) continue;
      (insideX || insideY ? sides : corners).push({ x, y });
    }
  }
  return [...sides, ...corners];
}
