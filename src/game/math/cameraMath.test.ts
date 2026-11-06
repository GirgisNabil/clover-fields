import { describe, expect, it } from "vitest";
import { clampTarget, panToAnchor, zoomAt, zoomLimits } from "./cameraMath";
import { tilesAlong } from "./dda";
import { type IsoView, screenToGround } from "./iso";

const view: IsoView = { targetX: 6, targetZ: 6, zoom: 40, width: 1280, height: 800 };

describe("zoomAt", () => {
  it("keeps the ground point under the cursor fixed", () => {
    const before = screenToGround(view, 300, 250);
    const zoomed = zoomAt(view, 300, 250, 1.6, { min: 10, max: 200 });
    const after = screenToGround(zoomed, 300, 250);
    expect(zoomed.zoom).toBeCloseTo(64);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.z).toBeCloseTo(before.z, 9);
  });

  it("respects the limits", () => {
    expect(zoomAt(view, 0, 0, 100, { min: 10, max: 50 }).zoom).toBe(50);
    expect(zoomAt(view, 0, 0, 0.01, { min: 10, max: 50 }).zoom).toBe(10);
  });

  it("never zooms out past fitting the farm", () => {
    const limits = zoomLimits(26, 1280, 800);
    expect(limits.min).toBeLessThan(limits.fit);
    expect(limits.max).toBe(130);
  });
});

describe("panning", () => {
  it("keeps the grabbed ground point under the pointer", () => {
    const anchor = screenToGround(view, 500, 400);
    const panned = panToAnchor(view, anchor, 700, 300);
    const under = screenToGround(panned, 700, 300);
    expect(under.x).toBeCloseTo(anchor.x, 9);
    expect(under.z).toBeCloseTo(anchor.z, 9);
  });

  it("clamps the target near the farm", () => {
    const far = clampTarget({ ...view, targetX: -40, targetZ: 99 }, 12);
    expect(far.targetX).toBe(-2);
    expect(far.targetZ).toBe(14);
  });
});

describe("tilesAlong", () => {
  it("lists every tile on a segment without gaps", () => {
    const tiles = tilesAlong(0.5, 0.5, 4.5, 2.5);
    expect(tiles[0]).toEqual({ x: 0, y: 0 });
    expect(tiles.at(-1)).toEqual({ x: 4, y: 2 });
    for (let i = 1; i < tiles.length; i++) {
      const a = tiles[i - 1];
      const b = tiles[i];
      if (!a || !b) continue;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });

  it("handles a single tile and reversed directions", () => {
    expect(tilesAlong(2.2, 2.2, 2.8, 2.9)).toEqual([{ x: 2, y: 2 }]);
    expect(tilesAlong(3.5, 3.5, 0.5, 3.5).map((t) => t.x)).toEqual([3, 2, 1, 0]);
  });
});
