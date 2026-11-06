import { isWalkable, type Tile, type WalkGrid } from "@/domain";

const SQRT2 = Math.SQRT2;

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
] as const;

/** Binary min-heap of (priority, value) pairs. Priorities are fixed at push time. */
class MinHeap {
  private priorities: number[] = [];
  private values: number[] = [];

  get size() {
    return this.values.length;
  }

  push(value: number, priority: number) {
    const p = this.priorities;
    const v = this.values;
    let i = v.length;
    p.push(priority);
    v.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((p[parent] as number) <= priority) break;
      p[i] = p[parent] as number;
      v[i] = v[parent] as number;
      i = parent;
    }
    p[i] = priority;
    v[i] = value;
  }

  pop(): number {
    const p = this.priorities;
    const v = this.values;
    const top = v[0] as number;
    const lastP = p.pop() as number;
    const lastV = v.pop() as number;
    const n = v.length;
    if (n === 0) return top;
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && (p[child + 1] as number) < (p[child] as number)) child++;
      if ((p[child] as number) >= lastP) break;
      p[i] = p[child] as number;
      v[i] = v[child] as number;
      i = child;
    }
    p[i] = lastP;
    v[i] = lastV;
    return top;
  }
}

/**
 * Shortest 8-directional path (no corner cutting) from `start` to the nearest of `goals`.
 * Coordinates are farm tiles; the grid includes a one-tile ring around the farm. The start
 * tile itself may be blocked (something can be placed under the farmer's feet).
 * Returns the tiles from start to goal inclusive, or null when no goal is reachable.
 */
export function findPath(grid: WalkGrid, start: Tile, goals: readonly Tile[]): Tile[] | null {
  const { stride } = grid;
  const toCell = (x: number, y: number) => (y + 1) * stride + (x + 1);
  const goalSet = new Set<number>();
  for (const goal of goals) {
    if (isWalkable(grid, goal.x, goal.y)) goalSet.add(toCell(goal.x, goal.y));
  }
  if (goalSet.size === 0) return null;
  const startCell = toCell(start.x, start.y);
  if (goalSet.has(startCell)) return [start];

  const count = stride * stride;
  const g = new Float64Array(count).fill(Infinity);
  const from = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const heuristic = (x: number, y: number) => {
    let best = Infinity;
    for (const goal of goals) {
      const dx = Math.abs(goal.x - x);
      const dy = Math.abs(goal.y - y);
      best = Math.min(best, Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy));
    }
    return best;
  };

  g[startCell] = 0;
  const open = new MinHeap();
  open.push(startCell, heuristic(start.x, start.y));

  while (open.size > 0) {
    const cell = open.pop();
    if (closed[cell]) continue;
    closed[cell] = 1;
    if (goalSet.has(cell)) {
      const path: Tile[] = [];
      for (let c = cell; c !== -1; c = from[c] ?? -1) {
        path.push({ x: (c % stride) - 1, y: Math.floor(c / stride) - 1 });
      }
      return path.reverse();
    }
    const cx = (cell % stride) - 1;
    const cy = Math.floor(cell / stride) - 1;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(grid, nx, ny)) continue;
      if (
        dx !== 0 &&
        dy !== 0 &&
        (!isWalkable(grid, cx + dx, cy) || !isWalkable(grid, cx, cy + dy))
      ) {
        continue;
      }
      const next = toCell(nx, ny);
      if (closed[next]) continue;
      const tentative = (g[cell] ?? Infinity) + cost;
      if (tentative < (g[next] ?? Infinity)) {
        g[next] = tentative;
        from[next] = cell;
        open.push(next, tentative + heuristic(nx, ny));
      }
    }
  }
  return null;
}

/** True if a straight walk between tile centers only crosses walkable tiles. */
function clearLine(grid: WalkGrid, a: Tile, b: Tile): boolean {
  const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + 0.5 + (b.x - a.x) * t;
    const y = a.y + 0.5 + (b.y - a.y) * t;
    // Check a small box around the sample so the farmer never clips a corner.
    for (const [ox, oy] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ] as const) {
      if (!isWalkable(grid, Math.floor(x + ox), Math.floor(y + oy))) return false;
    }
  }
  return true;
}

/** Drops waypoints the farmer can skip by walking straight (string pulling). */
export function smoothPath(grid: WalkGrid, path: readonly Tile[]): Tile[] {
  if (path.length <= 2) return [...path];
  const result: Tile[] = [path[0] as Tile];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1 && !clearLine(grid, path[anchor] as Tile, path[next] as Tile)) next--;
    result.push(path[next] as Tile);
    anchor = next;
  }
  return result;
}
