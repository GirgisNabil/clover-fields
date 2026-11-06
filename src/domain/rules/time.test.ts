import { describe, expect, it } from "vitest";
import { DAY, HOUR, MINUTE } from "../constants";
import type { ObjectId } from "../types/ids";
import type { CropState } from "../types/state";
import { cropStage, cropTimeline, nextCropChange, producerStatus } from "./time";

const T0 = 1_800_000_000_000;
const crop = (cropId: CropState["cropId"], overrides: Partial<CropState> = {}): CropState => ({
  cropId,
  plantedAt: T0,
  revivedAt: null,
  witherProof: false,
  fertilized: false,
  manure: null,
  ...overrides,
});

describe("crop growth", () => {
  it("ripens exactly at plantedAt + grow time", () => {
    const c = crop("sunpop_berry");
    expect(cropStage("o1", c, 7, T0 + 5 * MINUTE - 1).stage).toBe("growing");
    expect(cropStage("o1", c, 7, T0 + 5 * MINUTE).stage).toBe("ripe");
  });

  it("moves through four growth visuals", () => {
    const c = crop("tumble_pea"); // 30 minutes
    const visuals = [0, 8, 15, 23].map((m) => {
      const s = cropStage("o1", c, 7, T0 + m * MINUTE);
      return s.stage === "growing" ? s.visual : -1;
    });
    expect(visuals).toEqual([0, 1, 2, 3]);
  });

  it("reports the next visual change", () => {
    const timeline = cropTimeline("o1", crop("tumble_pea"), 7);
    expect(nextCropChange(timeline, T0)).toBe(T0 + 7.5 * MINUTE);
    expect(nextCropChange(timeline, T0 + 29 * MINUTE)).toBe(T0 + 30 * MINUTE);
    expect(nextCropChange(timeline, T0 + 31 * MINUTE)).toBe(timeline.witherAt);
    expect(nextCropChange(timeline, timeline.witherAt)).toBe(Infinity);
  });
});

describe("withering", () => {
  it("never happens before the safe window ends, always by the end of the cushion", () => {
    const witherTimes: number[] = [];
    for (let i = 1; i <= 1000; i++) {
      const id: ObjectId = `o${i}`;
      const t = cropTimeline(id, crop("goldenstalk_wheat"), 99); // 8 hours
      expect(t.safeUntil).toBe(T0 + 16 * HOUR);
      expect(t.witherAt).toBeGreaterThanOrEqual(t.safeUntil);
      expect(t.witherAt).toBeLessThan(T0 + 20 * HOUR);
      expect(cropStage(id, crop("goldenstalk_wheat"), 99, t.safeUntil - 1).stage).toBe("ripe");
      expect(cropStage(id, crop("goldenstalk_wheat"), 99, T0 + 20 * HOUR).stage).toBe("withered");
      witherTimes.push(t.witherAt - t.safeUntil);
    }
    const spread = Math.max(...witherTimes) - Math.min(...witherTimes);
    expect(spread).toBeGreaterThan(0.8 * 4 * HOUR);
  });

  it("is deterministic per plot and planting, and changes on replant", () => {
    const a = cropTimeline("o5", crop("goldenstalk_wheat"), 3).witherAt;
    expect(cropTimeline("o5", crop("goldenstalk_wheat"), 3).witherAt).toBe(a);
    const replanted = cropTimeline("o5", crop("goldenstalk_wheat", { plantedAt: T0 + 1 }), 3);
    expect(replanted.witherAt - 1).not.toBe(a);
  });

  it("gives short crops a minimum window", () => {
    const short = cropTimeline("o1", crop("clover_sprout"), 1); // 2 minutes
    expect(short.safeUntil - short.ripeAt).toBe(20 * MINUTE);
    expect(short.witherAt - short.safeUntil).toBeLessThan(10 * MINUTE);
    const long = cropTimeline("o1", crop("hillside_potato"), 1); // 1 day
    expect(long.safeUntil - long.ripeAt).toBe(1 * DAY);
    expect(long.witherAt - long.safeUntil).toBeLessThan(12 * HOUR);
  });

  it("never happens to a beginner's crop", () => {
    const c = crop("clover_sprout", { witherProof: true });
    expect(cropStage("o1", c, 1, T0 + 365 * DAY).stage).toBe("ripe");
  });

  it("restarts fresh windows after a revive", () => {
    const revived = crop("clover_sprout", { revivedAt: T0 + 5 * HOUR });
    expect(cropStage("o1", revived, 1, T0 + 5 * HOUR).stage).toBe("ripe");
    expect(cropStage("o1", revived, 1, T0 + 5 * HOUR + 19 * MINUTE).stage).toBe("ripe");
  });
});

describe("producers", () => {
  it("are ready one cycle after the cycle starts, and never wither", () => {
    expect(producerStatus(T0, HOUR, T0 + HOUR - 1).ready).toBe(false);
    expect(producerStatus(T0, HOUR, T0 + HOUR).ready).toBe(true);
    expect(producerStatus(T0, HOUR, T0 + 300 * DAY).ready).toBe(true);
    expect(producerStatus(T0, HOUR, T0 + HOUR / 2).progress).toBeCloseTo(0.5);
  });
});
