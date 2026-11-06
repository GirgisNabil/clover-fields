import { describe, expect, it } from "vitest";
import { MAX_ACTIVE_QUESTS } from "../catalog/quests";
import { HOUR, MINUTE } from "../constants";
import { applyCommand } from "../engine/apply";
import { animalAt, emptyFarm, freshFarm, must, T0, withLevel } from "../testing";
import type { Command } from "../types/commands";
import type { DomainEvent } from "../types/events";
import type { FarmState } from "../types/state";
import { isStepComplete, updateQuests } from "./quests";

function run(farm: FarmState, cmds: Command[], now: number) {
  let state = farm;
  const events: DomainEvent[] = [];
  for (const cmd of cmds) {
    const r = must(state, cmd, now);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe("the welcome tutorial", () => {
  it("starts on a new farm and walks through every step automatically", () => {
    let farm = freshFarm();
    expect(farm.quests.active.welcome).toMatchObject({ step: 0 });

    // 1. Harvest the four ripe starter clovers.
    let r = run(
      farm,
      [2, 3, 4, 5].map((x) => ({ type: "harvest", x, y: 4 }) as const),
      T0,
    );
    expect(r.events).toContainEqual({
      t: "questStep",
      lineId: "welcome",
      npc: "marigold",
      step: 0,
      last: false,
    });
    farm = r.state;
    expect(farm.quests.active.welcome?.step).toBe(1);

    // 2. Plow four plots (the harvested ones are fallow now).
    r = run(
      farm,
      [2, 3, 4, 5].map((x) => ({ type: "plow", x, y: 4 }) as const),
      T0,
    );
    farm = r.state;
    expect(farm.quests.active.welcome?.step).toBe(2);

    // 3. Plant four seeds.
    r = run(
      farm,
      [2, 3, 4, 5].map((x) => ({ type: "plant", x, y: 4, cropId: "clover_sprout" }) as const),
      T0,
    );
    farm = r.state;
    expect(farm.quests.active.welcome?.step).toBe(3);

    // 4. Collect from the hen.
    const hen = animalAt(farm, 8, 7);
    if (!hen) throw new Error("hen missing");
    farm = must(farm, { type: "collectAnimal", id: hen.id, x: 8, y: 7 }, T0 + HOUR).state;
    expect(farm.quests.active.welcome?.step).toBe(4);

    // 5. Place the Daisy Bed from the shed.
    const clovers = farm.wallet.clovers;
    r = run(farm, [{ type: "placeStored", defId: "daisy_bed", x: 0, y: 0, rot: 0 }], T0 + HOUR);
    expect(r.state.quests.active.welcome).toBeUndefined();
    expect(r.state.quests.done.welcome).toBe(T0 + HOUR);
    expect(r.state.wallet.clovers).toBe(clovers + 1);
    expect(r.events).toContainEqual(
      expect.objectContaining({ t: "questStep", lineId: "welcome", last: true }),
    );
  });

  it("is quietly skipped on farms that are already past it", () => {
    const veteran = { ...withLevel(emptyFarm(), 9, 900), quests: { active: {}, done: {} } };
    const after = must(veteran, { type: "settle" }, T0 + MINUTE).state;
    expect(after.quests.done.welcome).toBeDefined();
    expect(after.quests.active.welcome).toBeUndefined();
  });
});

describe("questlines", () => {
  it("run at most four at a time, starting in catalog order", () => {
    const farm = {
      ...withLevel(emptyFarm(), 20, 8050),
      quests: { active: {}, done: { welcome: T0 } },
    };
    const after = must(farm, { type: "settle" }, T0 + MINUTE).state;
    expect(Object.keys(after.quests.active)).toHaveLength(MAX_ACTIVE_QUESTS);
    // T0 (Nov 5) falls in the Lantern Harvest Fair, so its questline takes a slot too.
    expect(Object.keys(after.quests.active)).toEqual([
      "green_fingers",
      "hollis_lanterns",
      "dot_deliveries",
      "hollis_pride",
    ]);
  });

  it("count progress from when the step began", () => {
    const farm: FarmState = {
      ...withLevel(emptyFarm(), 2, 15),
      stats: { counters: { "harvest:crop": 500 } },
      quests: { active: {}, done: { welcome: T0 } },
    };
    const started = must(farm, { type: "settle" }, T0 + MINUTE).state;
    expect(started.quests.active.green_fingers?.base["harvest:crop"]).toBe(500);
    expect(isStepComplete(started, "green_fingers")).toBe(false);
  });

  it("need claiming, hand over deliveries, and refuse early claims", () => {
    let farm: FarmState = {
      ...withLevel(emptyFarm(), 15, 3800),
      quests: {
        active: { barnaby_mill: { step: 2, startedAt: T0, base: {} } },
        done: { welcome: T0 },
      },
      materials: { wheat_flour: 1 },
    };
    const early = applyCommand(farm, { type: "claimQuest", lineId: "barnaby_mill" }, { now: T0 });
    expect(early).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH_ITEMS", id: "wheat_flour", need: 2, have: 1 },
    });
    farm = { ...farm, materials: { wheat_flour: 3 } };
    const claimed = must(farm, { type: "claimQuest", lineId: "barnaby_mill" }, T0);
    expect(claimed.state.materials.wheat_flour).toBe(1);
    expect(claimed.state.quests.done.barnaby_mill).toBe(T0);
    expect(claimed.state.wallet.clovers).toBe(farm.wallet.clovers + 1);
  });

  it("is idempotent", () => {
    const farm = structuredClone(freshFarm());
    expect(updateQuests(farm, () => {}, T0)).toBe(false);
    expect(updateQuests(farm, () => {}, T0)).toBe(false);
  });
});
