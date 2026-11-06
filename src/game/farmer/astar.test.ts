import { describe, expect, it } from "vitest";
import type { WalkGrid } from "@/domain";
import { findPath, smoothPath } from "./astar";

/** Builds a square grid from rows of '.' (walkable) and '#' (blocked); unlisted tiles and the ring are walkable. */
function grid(rows: string[]): WalkGrid {
  const size = Math.max(rows.length, ...rows.map((row) => row.length));
  const stride = size + 2;
  const cells = new Uint8Array(stride * stride).fill(1);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") cells[(y + 1) * stride + (x + 1)] = 0;
    });
  });
  return { size, stride, cells };
}

const length = (path: { x: number; y: number }[]) => {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
};

describe("findPath", () => {
  it("walks straight and diagonally on open ground", () => {
    const g = grid([".....", ".....", ".....", ".....", "....."]);
    const path = findPath(g, { x: 0, y: 0 }, [{ x: 4, y: 4 }]);
    expect(path?.length).toBe(5);
    expect(length(path ?? [])).toBeCloseTo(4 * Math.SQRT2);
  });

  it("goes around walls without cutting corners", () => {
    const g = grid([".....", ".###.", ".#...", ".#...", "....."]);
    const path = findPath(g, { x: 2, y: 2 }, [{ x: 0, y: 0 }]);
    expect(path).not.toBeNull();
    for (let i = 1; i < (path?.length ?? 0); i++) {
      const a = path?.[i - 1];
      const b = path?.[i];
      if (!a || !b) continue;
      const blocked = (x: number, y: number) =>
        ["#"].includes([".....", ".###.", ".#...", ".#...", "....."][y]?.[x] ?? ".");
      if (a.x !== b.x && a.y !== b.y) {
        expect(blocked(b.x, a.y) || blocked(a.x, b.y)).toBe(false);
      }
      expect(blocked(b.x, b.y)).toBe(false);
    }
  });

  it("uses the outer ring and picks the nearest of several goals", () => {
    const g = grid(["#####", "#...#", "#...#", "#...#", "#####"]);
    const path = findPath(g, { x: -1, y: -1 }, [
      { x: 5, y: 5 },
      { x: 2, y: -1 },
    ]);
    expect(path?.at(-1)).toEqual({ x: 2, y: -1 });
  });

  it("returns null when every goal is walled off", () => {
    const g = grid(["#####", "#...#", "#...#", "#...#", "#####"]);
    expect(findPath(g, { x: -1, y: -1 }, [{ x: 2, y: 2 }])).toBeNull();
  });

  it("starts from a blocked tile", () => {
    const g = grid(["#....", ".....", "....."]);
    expect(findPath(g, { x: 0, y: 0 }, [{ x: 2, y: 0 }])).not.toBeNull();
  });
});

describe("smoothPath", () => {
  it("removes waypoints on a straight run and keeps corners around walls", () => {
    const g = grid([".....", ".....", "....."]);
    const path = findPath(g, { x: 0, y: 1 }, [{ x: 4, y: 1 }]) ?? [];
    expect(smoothPath(g, path)).toEqual([
      { x: 0, y: 1 },
      { x: 4, y: 1 },
    ]);
    const walled = grid([".....", "..#..", "....."]);
    const around = findPath(walled, { x: 0, y: 1 }, [{ x: 4, y: 1 }]) ?? [];
    expect(smoothPath(walled, around).length).toBeGreaterThan(2);
  });
});
