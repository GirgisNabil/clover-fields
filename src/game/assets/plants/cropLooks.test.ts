import { describe, expect, it } from "vitest";
import { CROPS } from "@/domain";
import { EVENT_CROPS } from "@/domain/catalog/events";
import { PLANT_MESHES } from "../plantManifest";
import { CROP_LOOKS } from "./cropLooks";

describe("crop looks", () => {
  it("cover every crop with meshes that were baked", () => {
    for (const crop of [...CROPS, ...EVENT_CROPS]) {
      const look = CROP_LOOKS[crop.id];
      expect(look, crop.id).toBeDefined();
      if (!look) continue;
      const names = look.only
        ? [look.only]
        : (look.mix ?? [look.prefix]).flatMap((p) => [1, 2, 3, 4].map((i) => `${p}_${i}`));
      if (look.ripeTop) names.push(look.ripeTop.mesh);
      for (const name of names) expect(PLANT_MESHES, `${crop.id} → ${name}`).toHaveProperty(name);
    }
  });
});
