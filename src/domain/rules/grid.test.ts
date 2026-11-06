import { describe, expect, it } from "vitest";
import { emptyFarm, freshFarm } from "../testing";
import type { FarmState } from "../types/state";
import { canPlace, footprint, objectAt } from "./grid";
import { approachTiles, isWalkable, walkableGrid } from "./walk";

const withBench = (farm: FarmState): FarmState => ({
  ...farm,
  objects: {
    o1: { kind: "decoration", id: "o1", defId: "garden_bench", x: 4, y: 4, rot: 0, placedAt: 0 },
  },
});

describe("footprints", () => {
  it("swap width and depth on odd rotations", () => {
    expect(footprint("garden_bench", 0)).toEqual({ w: 2, h: 1 });
    expect(footprint("garden_bench", 1)).toEqual({ w: 1, h: 2 });
    expect(footprint("garden_bench", 2)).toEqual({ w: 2, h: 1 });
    expect(footprint("garden_bench", 3)).toEqual({ w: 1, h: 2 });
    expect(footprint("plot", 1)).toEqual({ w: 1, h: 1 });
  });
});

describe("canPlace", () => {
  it("detects overlaps per rotation", () => {
    const farm = withBench(emptyFarm());
    expect(objectAt(farm, 5, 4)?.id).toBe("o1");
    expect(canPlace(farm, "daisy_bed", 5, 4, 0)).toEqual({ code: "OCCUPIED", by: "o1" });
    expect(canPlace(farm, "garden_bench", 3, 3, 0)).toBeNull();
    expect(canPlace(farm, "garden_bench", 4, 3, 1)).toEqual({ code: "OCCUPIED", by: "o1" });
  });

  it("lets an object move onto its own old footprint", () => {
    const farm = withBench(emptyFarm());
    expect(canPlace(farm, "garden_bench", 5, 4, 0, "o1")).toBeNull();
  });

  it("keeps items inside the farm", () => {
    const farm = emptyFarm();
    expect(canPlace(farm, "garden_gazebo", 10, 10, 0)).toEqual({ code: "OUT_OF_BOUNDS" });
    expect(canPlace(farm, "garden_gazebo", 9, 9, 0)).toBeNull();
    expect(
      canPlace({ ...farm, land: { size: 14, expansionIndex: 1 } }, "garden_gazebo", 10, 10, 0),
    ).toBeNull();
  });
});

describe("walkability", () => {
  it("lets the farmer cross plots, stepping stones and roaming animals but not fences", () => {
    const farm = freshFarm();
    const grid = walkableGrid(farm);
    expect(isWalkable(grid, 2, 4)).toBe(true); // planted plot
    expect(isWalkable(grid, 8, 7)).toBe(true); // hen (animals roam; they never block)
    expect(isWalkable(grid, 3, 7)).toBe(false); // fence
    expect(isWalkable(grid, -1, -1)).toBe(true); // outer ring
    expect(isWalkable(grid, -2, 0)).toBe(false);
  });

  it("finds approach tiles around blocked objects", () => {
    const farm = freshFarm();
    const fence = objectAt(farm, 3, 7);
    if (!fence) throw new Error("fence missing");
    const tiles = approachTiles(farm, fence);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) {
      expect(Math.abs(t.x - 3)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.y - 7)).toBeLessThanOrEqual(1);
      expect(objectAt(farm, t.x, t.y)?.kind ?? "grass").not.toBe("decoration");
    }
  });
});
