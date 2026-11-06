import { describe, expect, it } from "vitest";
import { MAX_LEVEL, PLOW_COST } from "../constants";
import { ANIMALS } from "./animals";
import {
  bushelChance,
  cropFirstStar,
  cropPlantXp,
  cropSale,
  cropSeedCost,
  producerPayout,
  producerPrice,
  xpOnBuy,
} from "./balance";
import { BUILDINGS } from "./buildings";
import { CROPS } from "./crops";
import { SHOP_DECORATIONS } from "./decorations";
import { LEVEL_XP, levelForXp, levelUpClovers, levelUpCoins, titleFor } from "./levels";
import { ALL_DEFS, unlocksAt } from "./registry";
import { TREES } from "./trees";

const near = (actual: number, expected: number, tolerance = 5) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe("catalog ids", () => {
  it("are unique", () => {
    const ids = ALL_DEFS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all unlock by level 50", () => {
    for (const def of ALL_DEFS) expect(def.unlockLevel).toBeLessThanOrEqual(MAX_LEVEL);
  });
});

describe("crops", () => {
  it.each(CROPS)("$name matches the crop formulas", (crop) => {
    near(crop.seedCost, cropSeedCost(crop.growMs, crop.unlockLevel));
    near(crop.sale, cropSale(crop.growMs, crop.unlockLevel));
    expect(crop.plantXp).toBe(cropPlantXp(crop.growMs));
    expect(crop.mastery[0]).toBe(cropFirstStar(crop.growMs));
    expect(crop.mastery[1]).toBe(crop.mastery[0] * 3);
    expect(crop.mastery[2]).toBe(crop.mastery[0] * 6);
  });

  it("always turn a profit after seed and plowing", () => {
    for (const crop of CROPS) expect(crop.sale - crop.seedCost - PLOW_COST).toBeGreaterThan(0);
  });

  it("need fewer harvests for mastery the longer they grow", () => {
    const byTime = [...CROPS].sort((a, b) => a.growMs - b.growMs);
    for (let i = 1; i < byTime.length; i++) {
      expect(byTime[i]?.mastery[0]).toBeLessThanOrEqual(byTime[i - 1]?.mastery[0] ?? 0);
    }
  });
});

describe("producers", () => {
  it.each([...ANIMALS, ...TREES])("$name matches the producer formulas", (producer) => {
    near(producer.payout, producerPayout(producer.kind, producer.cycleMs, producer.unlockLevel));
    near(
      "coins" in producer.price ? producer.price.coins : 0,
      producerPrice(producer.kind, producer.payout),
    );
    expect(producer.xpOnBuy).toBe(xpOnBuy("producer", producer.price));
  });
});

describe("buildings and decorations", () => {
  it("grant XP from their price", () => {
    for (const building of BUILDINGS) {
      if (building.price) expect(building.xpOnBuy).toBe(xpOnBuy("building", building.price));
    }
    for (const deco of SHOP_DECORATIONS) {
      if (deco.price) expect(deco.xpOnBuy).toBe(xpOnBuy("decoration", deco.price));
    }
  });

  it("fit on the starting 12×12 farm", () => {
    for (const def of [...ANIMALS, ...TREES, ...BUILDINGS, ...SHOP_DECORATIONS]) {
      expect(Math.max(...def.footprint)).toBeLessThanOrEqual(12);
    }
  });
});

describe("levels", () => {
  it("follow the published curve", () => {
    const expected: Record<number, number> = {
      1: 0,
      2: 15,
      3: 50,
      4: 110,
      5: 200,
      6: 330,
      7: 500,
      8: 720,
      9: 990,
      10: 1300,
      12: 2100,
      15: 3800,
      20: 8050,
      25: 14300,
      30: 22900,
      35: 34000,
      40: 47900,
      45: 64600,
      50: 84500,
    };
    for (const [level, xp] of Object.entries(expected)) expect(LEVEL_XP[Number(level)]).toBe(xp);
  });

  it("need strictly more XP for every level, in growing steps", () => {
    for (let level = 3; level <= MAX_LEVEL; level++) {
      const step = (LEVEL_XP[level] ?? 0) - (LEVEL_XP[level - 1] ?? 0);
      const previous = (LEVEL_XP[level - 1] ?? 0) - (LEVEL_XP[level - 2] ?? 0);
      expect(step).toBeGreaterThan(0);
      expect(step).toBeGreaterThanOrEqual(previous);
    }
  });

  it("maps XP to levels", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(14)).toBe(1);
    expect(levelForXp(15)).toBe(2);
    expect(levelForXp(1000)).toBe(9);
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
  });

  it("pay level-up rewards", () => {
    expect(levelUpCoins(2)).toBe(50);
    expect(levelUpCoins(9)).toBe(700);
    expect(levelUpClovers(4)).toBe(1);
    expect(levelUpClovers(5)).toBe(2);
  });

  it("have titles", () => {
    expect(titleFor(1)).toBe("Seedling");
    expect(titleFor(5)).toBe("Sprout Tender");
    expect(titleFor(49)).toBe("Verdant Legend");
    expect(titleFor(50)).toBe("Clover Monarch");
  });

  it("unlock new things", () => {
    expect(unlocksAt(2)).toContainEqual({ kind: "item", defId: "russet_hen" });
    expect(unlocksAt(2)).toContainEqual({ kind: "feature", feature: "animals" });
    expect(unlocksAt(4)).toContainEqual({ kind: "expansion", size: 14 });
    expect(unlocksAt(11)).toContainEqual({ kind: "upgrade", defId: "hen_house", tier: 2 });
  });
});

describe("bushels", () => {
  it("are worth at most 35% of a crop's net at 3 stars, even crafted", () => {
    for (const crop of CROPS) {
      const net = crop.sale - crop.seedCost - PLOW_COST;
      const bushel = Math.round((0.4 * crop.sale) / 5) * 5;
      const perHarvest = bushelChance(crop.growMs, 3, false) * bushel * 1.3;
      expect(perHarvest, crop.id).toBeLessThanOrEqual(0.35 * net);
    }
  });
});

describe("level rewards", () => {
  it("unlock something at every level from 2 to 50", () => {
    for (let level = 2; level <= 50; level++) {
      expect(unlocksAt(level).length, `level ${level}`).toBeGreaterThan(0);
    }
  });
});
