import { describe, expect, it } from "vitest";
import { HOUR, MINUTE } from "./constants";
import { applyCommand } from "./engine/apply";
import { fuelAt, settleFuel } from "./rules/fuel";
import { grantReward } from "./rules/reward";
import fixture from "./schema/fixtures/v1-midgame.json";
import fixtureV2 from "./schema/fixtures/v2-farm.json";
import { loadEnvelope, makeEnvelope } from "./schema/save";
import { animalAt, emptyFarm, freshFarm, must, T0, withLevel } from "./testing";
import type { DomainEvent } from "./types/events";
import type { FarmState } from "./types/state";

describe("save migration v2 → v3", () => {
  const loaded = loadEnvelope(fixtureV2);

  it("adds the settle clock and empty manure, and keeps playing", () => {
    if (!loaded.ok) throw new Error(`v2 fixture failed to load: ${JSON.stringify(loaded)}`);
    const s = loaded.state;
    expect(s.v).toBe(3);
    expect(s.animals).toEqual({ settledAt: fixtureV2.state.meta.lastNow });
    for (const obj of Object.values(s.objects)) {
      if (obj.kind === "plot" && obj.crop) expect(obj.crop.manure).toBeNull();
    }
    const later = must(s, { type: "settle" }, s.meta.lastNow + 3 * HOUR).state;
    expect(later.animals.settledAt).toBeGreaterThan(s.animals.settledAt);
  });
});

describe("save migration v1 → v2", () => {
  const loaded = loadEnvelope(fixture);

  it("loads a mid-game v1 save", () => {
    expect(loaded).toMatchObject({ ok: true, rev: 321, notes: [] });
  });

  it("adds the new slices and backfills collect counters", () => {
    if (!loaded.ok) throw new Error("fixture failed to load");
    const s = loaded.state;
    expect(s.v).toBe(3);
    expect(s.meta.dayOffsetMin).toBe(0);
    expect(s.fuel).toEqual({ units: 0, anchor: fixture.state.meta.lastNow });
    expect(s.stats.counters["collect:animal"]).toBe(30);
    expect(s.stats.counters["collect:tree"]).toBe(12);
    expect(s.materials).toEqual({});
    expect(s.quests).toEqual({ active: {}, done: {} });
    const plot = s.objects.o2;
    expect(plot?.kind === "plot" && plot.crop?.fertilized).toBe(false);
    const house = s.objects.o6;
    expect(house?.kind === "building" && house.jobs).toEqual([]);
  });

  it("keeps playing after migration", () => {
    if (!loaded.ok) throw new Error("fixture failed to load");
    const now = fixture.state.meta.lastNow + MINUTE;
    const harvested = must(loaded.state, { type: "harvest", x: 2, y: 4 }, now);
    expect(harvested.events.find((e) => e.t === "harvested")).toMatchObject({ coins: 35 });
    // The first command after migration awards the ribbon backlog, once and in tier order.
    const ribbons = harvested.events.filter((e) => e.t === "ribbon");
    expect(ribbons.length).toBeGreaterThan(0);
    expect(harvested.state.ribbons.harvester).toBeGreaterThanOrEqual(1);
    const next = must(harvested.state, { type: "settle" }, now + MINUTE);
    expect(next.events.filter((e) => e.t === "ribbon")).toHaveLength(0);
    const round = loadEnvelope(JSON.parse(JSON.stringify(makeEnvelope(harvested.state, 322, now))));
    expect(round.ok && round.state).toEqual(harvested.state);
  });
});

describe("fuel", () => {
  const farm = (units: number): FarmState => ({ ...emptyFarm(), fuel: { units, anchor: T0 } });

  it("regenerates one unit every five minutes up to the cap", () => {
    expect(fuelAt(farm(10), T0 + 25 * MINUTE)).toBe(15);
    expect(fuelAt(farm(10), T0 + 10 * HOUR)).toBe(50);
  });

  it("lets cans overfill the tank, pausing regeneration", () => {
    expect(fuelAt(farm(80), T0 + 10 * HOUR)).toBe(80);
  });

  it("keeps partial progress when settled", () => {
    const draft = structuredClone(farm(10));
    settleFuel(draft, T0 + 12 * MINUTE);
    expect(draft.fuel).toEqual({ units: 12, anchor: T0 + 10 * MINUTE });
  });
});

describe("hidden rolls", () => {
  const counter = (s: FarmState) => s.rng.counter;

  it("use a fixed budget per command", () => {
    const farm = freshFarm();
    const harvest = must(farm, { type: "harvest", x: 2, y: 4 }, T0);
    expect(counter(harvest.state) - counter(farm)).toBe(3);
    const plow = must(emptyFarm(), { type: "plow", x: 0, y: 0 }, T0);
    expect(counter(plow.state) - counter(emptyFarm())).toBe(1);
    const hen = animalAt(farm, 8, 7);
    if (!hen) throw new Error("hen missing");
    const collect = must(farm, { type: "collectAnimal", id: hen.id, x: 8, y: 7 }, T0);
    expect(counter(collect.state) - counter(farm)).toBe(1);
  });

  it("drop bushels only once crafting unlocks, deterministically", () => {
    const run = (level: number) => {
      let state = withLevel(emptyFarm(T0, 1_000_000), level, level >= 15 ? 3800 : 330);
      let bushels = 0;
      for (let i = 0; i < 200; i++) {
        const now = T0 + i * 10 * MINUTE;
        state = must(state, { type: "plow", x: 0, y: 0 }, now).state;
        state = must(state, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, now).state;
        const done = must(state, { type: "harvest", x: 0, y: 0 }, now + 3 * MINUTE);
        bushels += done.events.filter(
          (e) => e.t === "material" && e.delta > 0 && e.id.startsWith("bushel_"),
        ).length;
        state = done.state;
      }
      return bushels;
    };
    expect(run(10)).toBe(0);
    const high = run(15);
    expect(high).toBeGreaterThan(0);
    expect(run(15)).toBe(high);
  });
});

describe("rewards", () => {
  it("grant everything, capping materials and leveling up last", () => {
    const draft = structuredClone(emptyFarm());
    const events: DomainEvent[] = [];
    grantReward(
      draft,
      {
        coins: 100,
        clovers: 1,
        fuel: 10,
        items: { daisy_bed: 1 },
        materials: { brass_cog: 150 },
        xp: 20,
      },
      (e) => events.push(e),
      "quest",
      T0,
    );
    expect(draft.materials.brass_cog).toBe(99);
    expect(draft.inventory.items.daisy_bed).toBe(1);
    expect(draft.fuel.units).toBe(10);
    expect(events.at(-1)?.t).toBe("levelUp");
  });
});

describe("dev time rebase", () => {
  it("shifts every stored timestamp", () => {
    const farm: FarmState = {
      ...freshFarm(),
      daily: { lastClaimAt: T0, streak: 1, best: 1, taskAt: T0, tasks: [] },
      neighbors: {
        marigold: { helpAt: T0, helped: [], giftAt: T0, giftedAt: null, friendship: 0 },
      },
      quests: { active: { welcome: { step: 0, startedAt: T0, base: {} } }, done: { other: T0 } },
    };
    const result = applyCommand(
      farm,
      { type: "dev", op: { kind: "rebaseTime", deltaMs: HOUR } },
      { now: T0, dev: true },
    );
    if (!result.ok) throw new Error("rebase failed");
    const s = result.state;
    expect(s.fuel.anchor).toBe(farm.fuel.anchor - HOUR);
    expect(s.daily.lastClaimAt).toBe(T0 - HOUR);
    expect(s.neighbors.marigold?.helpAt).toBe(T0 - HOUR);
    expect(s.quests.active.welcome?.startedAt).toBe(T0 - HOUR);
    expect(s.quests.done.other).toBe(T0 - HOUR);
  });
});
