import { describe, expect, it } from "vitest";
import { MANURE, manuredSale, ROAM } from "../catalog/balance";
import { getCrop } from "../catalog/registry";
import { HOUR, MINUTE } from "../constants";
import { applyCommand } from "../engine/apply";
import { animalAt, emptyFarm, must, T0, withLevel } from "../testing";
import type { Command } from "../types/commands";
import type { Ms } from "../types/ids";
import type { FarmState, PlotObject } from "../types/state";
import { animalSpot, roamers, settleAnimals, visitTile, windowOf } from "./animals";
import { isPollinated } from "./drops";
import { objectAt } from "./grid";
import { reachableTiles } from "./pasture";
import { cropTimeline } from "./time";

const CROP = "hillside_potato"; // 1 day: still growing through every test window
const settle = (farm: FarmState, now: Ms) => must(farm, { type: "settle" }, now);

function apply(farm: FarmState, cmds: Command[], now: Ms) {
  return cmds.reduce((s, cmd) => must(s, cmd, now).state, farm);
}

/** A 5×5 potato field at (0..4, 0..4) and a few hens just east of it, everything at `now`. */
function fieldWithHens(now: Ms = T0, hens = 4): FarmState {
  let farm = withLevel(emptyFarm(now, 1_000_000), 30, 22_900);
  farm = { ...farm, animals: { settledAt: now } };
  const cmds: Command[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      cmds.push({ type: "plow", x, y }, { type: "plant", x, y, cropId: CROP });
    }
  }
  for (let i = 0; i < hens; i++) {
    cmds.push({ type: "buyPlace", defId: "russet_hen", x: 5, y: i, rot: 0 });
  }
  return apply(farm, cmds, now);
}

const plots = (farm: FarmState) =>
  Object.values(farm.objects).filter((o): o is PlotObject => o.kind === "plot");
const manured = (farm: FarmState) => plots(farm).filter((p) => p.crop?.manure);

describe("roaming animals", () => {
  it("settle the same way however often commands happen", () => {
    const farm = fieldWithHens();
    const once = settle(farm, T0 + 3 * HOUR).state;
    let stepped = farm;
    for (let h = 1; h <= 3; h++) stepped = settle(stepped, T0 + h * HOUR).state;
    expect(stepped).toEqual(once);
  });

  it("manure growing crops they wander over during the day, once per crop", () => {
    const farm = fieldWithHens(T0, 6);
    const day = settle(farm, T0 + 6 * HOUR);
    const first = manured(day.state);
    expect(first.length).toBeGreaterThan(0);
    expect(day.events.filter((e) => e.t === "manured")).toHaveLength(first.length);
    for (const plot of first) expect(plot.crop?.fertilized).toBe(true);
    // More time never re-manures or moves the first manure.
    const later = settle(day.state, T0 + 7 * HOUR + 50 * MINUTE).state;
    for (const plot of first) {
      const again = later.objects[plot.id] as PlotObject;
      expect(again.crop?.manure).toEqual(plot.crop?.manure);
    }
  });

  it("rest at home from 20:00 to 06:00", () => {
    const evening = Date.UTC(2026, 10, 5, 20, 0, 0);
    const farm = fieldWithHens(evening, 6);
    const night = settle(farm, evening + 10 * HOUR);
    expect(manured(night.state)).toHaveLength(0);
    const hen = animalAt(farm, 5, 0);
    if (!hen) throw new Error("hen missing");
    expect(animalSpot(night.state, hen.id, evening + 2 * HOUR)).toEqual({
      tile: { x: 5, y: 0 },
      resting: true,
    });
  });

  it("catch up at most 48 hours after a long absence", () => {
    const farm = fieldWithHens(T0, 6);
    const now = T0 + 100 * HOUR;
    const back = settle(farm, now).state;
    expect(back.animals.settledAt).toBe(windowOf(now) * ROAM.windowMs);
    for (const plot of manured(back)) {
      expect(plot.crop?.manure?.at).toBeGreaterThanOrEqual(now - ROAM.catchUpMs);
    }
  });

  it("stay inside a fenced pasture", () => {
    let farm = withLevel(emptyFarm(T0, 1_000_000), 30, 22_900);
    const cmds: Command[] = [];
    for (let i = 6; i <= 10; i++) {
      for (const [x, y] of [
        [i, 6],
        [i, 10],
        [6, i],
        [10, i],
      ] as const) {
        if (!objectAt(apply(farm, cmds, T0), x, y)) {
          cmds.push({ type: "buyPlace", defId: "rail_fence", x, y, rot: 0 });
        }
      }
    }
    cmds.push({ type: "buyPlace", defId: "dapple_cow", x: 8, y: 8, rot: 0 });
    farm = apply(farm, cmds, T0);
    const [cow] = roamers(farm, 0);
    if (!cow) throw new Error("cow missing");
    const inside = reachableTiles(farm, cow.starts, cow.radius);
    expect(inside).toHaveLength(9);
    for (let w = 0; w < 200; w++) {
      const t = visitTile(farm, cow, w);
      expect(t.x >= 7 && t.x <= 9 && t.y >= 7 && t.y <= 9).toBe(true);
    }
  });

  it("find collectable animals by day and by night", () => {
    const farm = fieldWithHens();
    const hen = animalAt(farm, 5, 0);
    if (!hen) throw new Error("hen missing");
    const [roamer] = roamers(farm, 0).filter((r) => r.id === hen.id);
    if (!roamer) throw new Error("hen not roaming");
    const noon = T0 + 30 * MINUTE;
    expect(animalSpot(farm, hen.id, noon)).toEqual({
      tile: visitTile(farm, roamer, windowOf(noon)),
      resting: false,
    });
    const collected = must(farm, { type: "collectAnimal", id: hen.id, x: 0, y: 0 }, T0 + 2 * HOUR);
    expect(collected.events.some((e) => e.t === "harvested")).toBe(true);
  });

  it("send a few of a home's animals out each day", () => {
    let farm = withLevel(emptyFarm(T0, 1_000_000), 30, 22_900);
    farm = must(farm, { type: "buyPlace", defId: "hen_house", x: 0, y: 0, rot: 0 }, T0).state;
    const house = objectAt(farm, 0, 0);
    if (!house) throw new Error("house missing");
    for (let i = 0; i < 10; i++) {
      farm = must(farm, { type: "buyPlace", defId: "russet_hen", x: 6, y: 6, rot: 0 }, T0).state;
      const hen = animalAt(farm, 6, 6);
      if (!hen) throw new Error("hen missing");
      farm = must(farm, { type: "house", id: hen.id, buildingId: house.id }, T0).state;
    }
    const out = roamers(farm, 3);
    expect(out).toHaveLength(4);
    expect(new Set(out.map((r) => r.homeId))).toEqual(new Set([house.id]));
  });
});

describe("manure", () => {
  it("ripens sooner, pays more and counts double for mastery", () => {
    const farm = fieldWithHens(T0, 0);
    const plot = objectAt(farm, 0, 0) as PlotObject;
    if (!plot.crop) throw new Error("crop missing");
    const def = getCrop(CROP);
    if (!def) throw new Error("crop def missing");
    const at = T0 + 4 * HOUR;
    const crop = { ...plot.crop, manure: { at, by: "russet_hen" }, fertilized: true };
    const base = T0 + def.growMs;
    const ripeAt = Math.round(base - MANURE.growCut * (base - at));
    expect(cropTimeline(plot.id, crop, farm.meta.witherSalt).ripeAt).toBe(ripeAt);

    const withManure: FarmState = {
      ...farm,
      animals: { settledAt: ripeAt + HOUR },
      objects: { ...farm.objects, [plot.id]: { ...plot, crop } },
    };
    expect(
      applyCommand(withManure, { type: "harvest", x: 0, y: 0 }, { now: ripeAt - 1 }),
    ).toMatchObject({ ok: false, error: { code: "NOT_READY" } });
    const done = must(withManure, { type: "harvest", x: 0, y: 0 }, ripeAt);
    expect(done.state.wallet.coins - withManure.wallet.coins).toBe(manuredSale(def.sale));
    expect(done.state.mastery[CROP]?.count).toBe(2);
  });
});

describe("silk moths", () => {
  it("pollinate crops within 3 tiles of a hut with moths", () => {
    let farm = withLevel(emptyFarm(T0, 1_000_000), 30, 22_900);
    farm = must(farm, { type: "buyPlace", defId: "silk_moth_hut", x: 0, y: 0, rot: 0 }, T0).state;
    expect(isPollinated(farm, 4, 1)).toBe(false); // empty hut
    farm = must(farm, { type: "buyPlace", defId: "silk_moth", x: 8, y: 8, rot: 0 }, T0).state;
    const moth = animalAt(farm, 8, 8);
    const hut = objectAt(farm, 0, 0);
    if (!moth || !hut) throw new Error("moth or hut missing");
    expect(roamers(farm, 0)).toHaveLength(0); // moths never roam
    farm = must(farm, { type: "house", id: moth.id, buildingId: hut.id }, T0).state;
    expect(isPollinated(farm, 4, 1)).toBe(true);
    expect(isPollinated(farm, 4, 4)).toBe(true);
    expect(isPollinated(farm, 5, 1)).toBe(false);
    const collected = must(farm, { type: "harvest", x: 0, y: 0 }, T0 + 12 * HOUR);
    expect(collected.state.materials.silk).toBe(1);
  });
});

describe("settleAnimals", () => {
  it("does nothing before a window finishes", () => {
    const farm = fieldWithHens();
    const events: unknown[] = [];
    const draft = structuredClone(farm);
    settleAnimals(draft, (e) => events.push(e), T0 + ROAM.windowMs - 1);
    expect(draft).toEqual(farm);
  });
});
