import { describe, expect, it } from "vitest";
import { DAILY_BONUS, DAILY_TASKS, dailyReward } from "../catalog/daily";
import { HELPS_PER_DAY, NEIGHBORS } from "../catalog/neighbors";
import { DAY, HOUR } from "../constants";
import { helpTargets, neighborFarm } from "../npc/farmGen";
import { rectOf } from "../rules/grid";
import { emptyFarm, must, T0, withLevel } from "../testing";
import type { FarmState, PlotObject } from "../types/state";
import { applyCommand } from "./apply";
import { neighborState, visitFarm } from "./handlers/social";

const refuse = (farm: FarmState, cmd: Parameters<typeof applyCommand>[1], now = T0) =>
  applyCommand(farm, cmd, { now });

describe("daily bonus", () => {
  const farm = withLevel(emptyFarm(T0, 0), 10, 1200);

  it("pays once a day along a 7-day streak, resetting after a missed day", () => {
    const d1 = must(farm, { type: "claimDaily" }, T0).state;
    expect(d1.wallet.coins).toBeGreaterThanOrEqual(dailyReward(0, 10).coins ?? 0);
    expect(d1.daily).toMatchObject({ streak: 1, best: 1, lastClaimAt: T0 });
    expect(refuse(d1, { type: "claimDaily" }, T0 + HOUR)).toMatchObject({
      ok: false,
      error: { code: "WRONG_STATE" },
    });

    const d2 = must(d1, { type: "claimDaily" }, T0 + DAY).state;
    expect(d2.daily.streak).toBe(2);
    expect(d2.materials.fertilizer_sack).toBe(2);

    // Skip a day: back to day one.
    const late = must(d2, { type: "claimDaily" }, T0 + 3 * DAY).state;
    expect(late.daily).toMatchObject({ streak: 1, best: 2 });
  });

  it("gives a Golden Clover on the seventh day", () => {
    let state = farm;
    for (let d = 0; d < 7; d++) state = must(state, { type: "claimDaily" }, T0 + d * DAY).state;
    expect(state.daily.streak).toBe(7);
    expect(state.wallet.clovers).toBeGreaterThanOrEqual(farm.wallet.clovers + 1);
  });
});

describe("daily tasks", () => {
  it("deal three a day, pay each, and a bonus once all three are done", () => {
    const farm = withLevel(emptyFarm(T0, 0), 10, 1200);
    const dealt = must(farm, { type: "settle" }, T0).state;
    expect(dealt.daily.tasks).toHaveLength(3);
    // Push every task's stat past its goal.
    const counters = { ...dealt.stats.counters };
    for (const task of dealt.daily.tasks) {
      const def = DAILY_TASKS.find((d) => d.id === task.id);
      if (def) counters[def.stat] = (counters[def.stat] ?? 0) + def.n;
    }
    const pushed = { ...dealt, stats: { counters } };
    const done = must(pushed, { type: "settle" }, T0 + HOUR);
    expect(done.state.daily.tasks.every((t) => t.done)).toBe(true);
    expect(done.events.filter((e) => e.t === "dailyTask")).toHaveLength(3);
    expect(done.events.filter((e) => e.t === "dailyBonus")).toHaveLength(1);
    expect(done.state.wallet.clovers).toBe(pushed.wallet.clovers + DAILY_BONUS.clovers);
    const again = must(done.state, { type: "settle" }, T0 + 2 * HOUR);
    expect(again.events.filter((e) => e.t === "dailyBonus")).toHaveLength(0);
    const tomorrow = must(done.state, { type: "settle" }, T0 + DAY).state;
    expect(tomorrow.daily.tasks.every((t) => !t.done)).toBe(true);
  });
});

describe("neighbour farms", () => {
  it("are the same all day, change the next, never overlap and always have chores", () => {
    for (const n of NEIGHBORS) {
      const a = neighborFarm(n.id, 100, [], T0);
      expect(neighborFarm(n.id, 100, [], T0)).toEqual(a);
      expect(neighborFarm(n.id, 101, [], T0)).not.toEqual(a);
      const cells = new Set<string>();
      for (const obj of Object.values(a.objects)) {
        if (obj.kind === "animal") continue;
        const r = rectOf(obj);
        for (let y = r.y; y < r.y + r.h; y++) {
          for (let x = r.x; x < r.x + r.w; x++) {
            const key = `${x},${y}`;
            expect(cells.has(key), `${n.id} overlaps at ${key}`).toBe(false);
            expect(x >= 0 && y >= 0 && x < a.land.size && y < a.land.size).toBe(true);
            cells.add(key);
          }
        }
      }
      expect(helpTargets(a, T0).length).toBeGreaterThanOrEqual(HELPS_PER_DAY);
    }
  });
});

describe("helping neighbours", () => {
  const farm = withLevel(emptyFarm(T0, 0), 10, 1200);
  const npc = "barnaby";

  it("allows five chores a day for coins, XP and friendship", () => {
    let state = farm;
    for (let i = 0; i < HELPS_PER_DAY; i++) {
      const [target] = helpTargets(visitFarm(state, npc, T0), T0);
      if (!target) throw new Error("no chores left");
      state = must(state, { type: "helpNeighbor", npcId: npc, x: target.x, y: target.y }, T0).state;
    }
    expect(neighborState(state, npc)).toMatchObject({ friendship: 5 });
    expect(state.wallet.coins).toBeGreaterThan(0);
    const [more] = helpTargets(visitFarm(state, npc, T0), T0);
    if (more) {
      expect(
        refuse(state, { type: "helpNeighbor", npcId: npc, x: more.x, y: more.y }),
      ).toMatchObject({
        ok: false,
        error: { code: "NOTHING_TO_DO" },
      });
    }
    // Tomorrow the farm is fresh and the count starts over.
    const [tomorrow] = helpTargets(visitFarm(state, npc, T0 + DAY), T0 + DAY);
    if (!tomorrow) throw new Error("no chores tomorrow");
    must(state, { type: "helpNeighbor", npcId: npc, x: tomorrow.x, y: tomorrow.y }, T0 + DAY);
  });

  it("shows helped tiles as done, and refuses non-chores", () => {
    const [target] = helpTargets(visitFarm(farm, npc, T0), T0);
    if (!target) throw new Error("no chores");
    const helped = must(
      farm,
      { type: "helpNeighbor", npcId: npc, x: target.x, y: target.y },
      T0,
    ).state;
    const after = helpTargets(visitFarm(helped, npc, T0), T0);
    expect(after).not.toContainEqual(target);
    expect(
      refuse(helped, { type: "helpNeighbor", npcId: npc, x: target.x, y: target.y }),
    ).toMatchObject({
      ok: false,
    });
    expect(refuse(farm, { type: "helpNeighbor", npcId: npc, x: 13, y: 13 })).toMatchObject({
      ok: false,
      error: { code: "NO_TARGET" },
    });
  });

  it("sends a daily gift once you have a heart", () => {
    expect(refuse(farm, { type: "claimGift", npcId: npc })).toMatchObject({ ok: false });
    const friend = {
      ...farm,
      neighbors: {
        [npc]: { helpAt: null, helped: [], giftAt: null, giftedAt: null, friendship: 5 },
      },
    };
    const gifted = must(friend, { type: "claimGift", npcId: npc }, T0);
    expect(gifted.events).toContainEqual({ t: "giftReceived", npcId: npc });
    expect(refuse(gifted.state, { type: "claimGift", npcId: npc }, T0 + HOUR)).toMatchObject({
      ok: false,
    });
    must(gifted.state, { type: "claimGift", npcId: npc }, T0 + DAY);
  });

  it("accepts one crafted good a day for +3 friendship", () => {
    const rich = { ...farm, materials: { wheat_flour: 2 } };
    const given = must(rich, { type: "giftNeighbor", npcId: npc, id: "wheat_flour" }, T0).state;
    expect(given.materials.wheat_flour).toBe(1);
    expect(neighborState(given, npc).friendship).toBe(3);
    expect(
      refuse(given, { type: "giftNeighbor", npcId: npc, id: "wheat_flour" }, T0 + HOUR),
    ).toMatchObject({ ok: false });
  });
});

describe("fertilizer sacks", () => {
  it("manure the growing crops in a 3×3 square", () => {
    let farm = withLevel(emptyFarm(T0, 10_000), 10, 1200);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        farm = must(farm, { type: "plow", x, y }, T0).state;
        farm = must(farm, { type: "plant", x, y, cropId: "hillside_potato" }, T0).state;
      }
    }
    expect(refuse(farm, { type: "fertilize", x: 1, y: 1 })).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH_ITEMS" },
    });
    farm = { ...farm, materials: { fertilizer_sack: 1 } };
    const done = must(farm, { type: "fertilize", x: 1, y: 1 }, T0 + HOUR).state;
    const manured = Object.values(done.objects).filter(
      (o) => o.kind === "plot" && o.crop?.manure,
    ) as PlotObject[];
    expect(manured).toHaveLength(9);
    expect(done.materials.fertilizer_sack).toBeUndefined();
  });
});
