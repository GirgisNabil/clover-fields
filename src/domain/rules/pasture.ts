import type { Tile } from "../types/ids";
import type { FarmState } from "../types/state";
import { isWalkable, walkableGrid } from "./walk";

const cache = new WeakMap<object, Map<string, Tile[]>>();

/**
 * Tiles an animal can reach from its home: a breadth-first fill over walkable farm tiles, at most
 * `radius` steps, stopped by fences, buildings and the farm edge. The start tiles are always
 * included. Sorted row-major so hash picks are stable. Memoized per `objects` map.
 */
export function reachableTiles(
  state: Pick<FarmState, "objects" | "land">,
  starts: readonly Tile[],
  radius: number,
): Tile[] {
  const key = `${starts.map((t) => `${t.x},${t.y}`).join(";")}:${radius}`;
  let byKey = cache.get(state.objects);
  if (!byKey) {
    byKey = new Map();
    cache.set(state.objects, byKey);
  }
  const cached = byKey.get(key);
  if (cached) return cached;

  const size = state.land.size;
  const grid = walkableGrid(state);
  const dist = new Map<number, number>();
  const queue: Tile[] = [];
  for (const start of starts) {
    if (start.x < 0 || start.y < 0 || start.x >= size || start.y >= size) continue;
    const id = start.y * size + start.x;
    if (dist.has(id)) continue;
    dist.set(id, 0);
    queue.push(start);
  }
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head] as Tile;
    const d = dist.get(tile.y * size + tile.x) ?? 0;
    if (d >= radius) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = tile.x + dx;
      const y = tile.y + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const id = y * size + x;
      if (dist.has(id) || !isWalkable(grid, x, y)) continue;
      dist.set(id, d + 1);
      queue.push({ x, y });
    }
  }
  const tiles = queue.sort((a, b) => a.y - b.y || a.x - b.x);
  byKey.set(key, tiles);
  return tiles;
}
