import { describe, expect, it } from "vitest";
import { findChance, RIBBON_REWARDS } from "../catalog/balance";
import { COLLECTIONS, getSet } from "../catalog/collections";
import { applyCommand } from "../engine/apply";
import { emptyFarm, must, T0, withLevel } from "../testing";
import type { DomainEvent } from "../types/events";
import type { FarmState } from "../types/state";
import { tryFind } from "./collections";
import { awardRibbons } from "./ribbons";

const PLOW = { kind: "plow" } as const;
const set = getSet("plowmans_finds");
if (!set) throw new Error("set missing");

function find(level: number, u: number) {
  const draft = structuredClone(withLevel(emptyFarm(), level, level >= 7 ? 600 : 0));
  const events: DomainEvent[] = [];
  const id = tryFind(draft, PLOW, u, (e) => events.push(e));
  return { id, draft, events };
}

const withAll = (farm: FarmState, extra: Record<string, number> = {}): FarmState => ({
  ...farm,
  materials: {
    ...farm.materials,
    ...Object.fromEntries(set.items.map((i) => [i.id, 1])),
    ...extra,
  },
});

describe("collectible finds", () => {
  it("use the action's roll: below the chance it also picks the item by rarity", () => {
    const chance = findChance(PLOW);
    expect(find(7, chance).id).toBeNull();
    expect(find(7, 0).id).toBe(set.items[0]?.id); // most common slot
    expect(find(7, chance * 0.999).id).toBe(set.items[5]?.id); // very rare slot
    const { draft, events } = find(7, chance / 2);
    expect(events).toContainEqual(expect.objectContaining({ t: "found", setId: set.id }));
    expect(Object.values(draft.materials).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("start at the collections level", () => {
    expect(find(6, 0).id).toBeNull();
  });

  it("scale crop find chance with grow time between 4% and 20%", () => {
    const short = findChance({ kind: "crop", growMs: 2 * 60_000 });
    const long = findChance({ kind: "crop", growMs: 4 * 24 * 3_600_000 });
    expect(short).toBeCloseTo(0.04);
    expect(long).toBeLessThanOrEqual(0.2);
    expect(long).toBeGreaterThan(0.15);
  });

  it("cover every crop shape, and every set has six items", () => {
    for (const s of COLLECTIONS) expect(s.items).toHaveLength(6);
    const shapes = [
      "sprig",
      "bush",
      "root",
      "grain",
      "pod",
      "stalk",
      "vine",
      "tallflower",
      "leafy",
      "spiky",
      "flower",
    ] as const;
    for (const shape of shapes) {
      expect(COLLECTIONS.some((s) => s.matches({ kind: "crop", shape, growMs: 1 }))).toBe(true);
    }
  });
});

describe("turning in sets", () => {
  const farm = withLevel(emptyFarm(T0, 0), 10, 1200);

  it("needs all six, consumes them, and pays more each time up to 4×", () => {
    expect(applyCommand(farm, { type: "redeemSet", setId: set.id }, { now: T0 })).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH_ITEMS" },
    });
    let state = farm;
    const paid: number[] = [];
    for (let i = 0; i < 8; i++) {
      const done = must(withAll(state), { type: "redeemSet", setId: set.id }, T0);
      state = done.state;
      // Only the set's own payout (ribbons and level-ups it triggers pay separately).
      paid.push(
        done.events
          .filter((e) => e.t === "coins" && e.reason === "collection")
          .reduce((sum, e) => sum + (e.t === "coins" ? e.delta : 0), 0),
      );
      for (const item of set.items) expect(state.materials[item.id]).toBeUndefined();
    }
    expect(paid.slice(0, 4)).toEqual([600, 900, 1200, 1500]);
    expect(paid.slice(6)).toEqual([2400, 2400]);
    expect(state.collections[set.id]).toEqual({ redeemed: 8 });
  });

  it("gives a trophy and a Golden Clover the first time, and a Brass Cog every fifth", () => {
    const first = must(withAll(farm), { type: "redeemSet", setId: set.id }, T0).state;
    expect(first.inventory.items[`trophy_${set.id}`]).toBe(1);
    expect(first.wallet.clovers).toBe(farm.wallet.clovers + 1);
    const fourTimes = { ...first, collections: { [set.id]: { redeemed: 4 } } };
    const fifth = must(withAll(fourTimes), { type: "redeemSet", setId: set.id }, T0).state;
    expect(fifth.materials.brass_cog).toBe(1);
  });
});

describe("trading duplicates", () => {
  const farm = withLevel(emptyFarm(), 10, 1200);
  const [c1, c2, , , rare, veryRare] = set.items;
  if (!c1 || !c2 || !rare || !veryRare) throw new Error("items missing");

  it("costs 3 / 6 / 10 spares by rarity, taken from the biggest pile first", () => {
    const rich = { ...farm, materials: { [c1.id]: 5, [c2.id]: 4 } };
    const done = must(rich, { type: "swapCollectible", want: rare.id }, T0).state;
    expect(done.materials[rare.id]).toBe(1);
    expect(done.materials[c1.id]).toBe(1);
    expect(done.materials[c2.id]).toBe(2);
    expect(
      applyCommand(rich, { type: "swapCollectible", want: veryRare.id }, { now: T0 }),
    ).toMatchObject({ ok: false, error: { code: "NOT_ENOUGH_ITEMS", need: 10, have: 7 } });
  });

  it("only trades for pieces you don't have", () => {
    const rich = { ...farm, materials: { [c1.id]: 9 } };
    expect(applyCommand(rich, { type: "swapCollectible", want: c1.id }, { now: T0 })).toMatchObject(
      { ok: false, error: { code: "WRONG_STATE" } },
    );
  });
});

describe("ribbons", () => {
  const counters = (n: number) => ({ counters: { "harvest:crop": n } });

  it("award every tier crossed, in order, once", () => {
    const draft = structuredClone({ ...withLevel(emptyFarm(), 5, 200), stats: counters(300) });
    const events: DomainEvent[] = [];
    expect(awardRibbons(draft, (e) => events.push(e), T0)).toBe(true);
    expect(events.filter((e) => e.t === "ribbon")).toEqual([
      { t: "ribbon", id: "harvester", tier: 1 },
      { t: "ribbon", id: "harvester", tier: 2 },
    ]);
    const coins = events
      .filter((e) => e.t === "coins")
      .reduce((s, e) => s + (e.t === "coins" ? e.delta : 0), 0);
    expect(coins).toBe(RIBBON_REWARDS[0].coins + RIBBON_REWARDS[1].coins);
    expect(awardRibbons(draft, () => {}, T0)).toBe(false);
  });

  it("wait for the ribbons level, then award the backlog", () => {
    const early = structuredClone({ ...withLevel(emptyFarm(), 1, 0), stats: counters(30) });
    expect(awardRibbons(early, () => {}, T0)).toBe(false);
    early.progress = { level: 2, xp: 15 };
    expect(awardRibbons(early, () => {}, T0)).toBe(true);
    expect(early.ribbons.harvester).toBe(1);
  });
});
