import { describe, expect, it } from "vitest";
import { EVENTS, eventWindow, TOKEN_COIN_VALUE } from "../catalog/events";
import { DAY, HOUR } from "../constants";
import { applyCommand } from "../engine/apply";
import { emptyFarm, must, T0, withLevel } from "../testing";
import type { FarmState } from "../types/state";
import { activeEvent, nextEvent, tokensNow } from "./events";

const FAIR = Date.UTC(2026, 9, 26, 12); // Oct 26, during the Lantern Harvest Fair
const AFTER = Date.UTC(2026, 10, 20, 12); // Nov 20, after it

function field(now: number): FarmState {
  let farm = withLevel(emptyFarm(now, 100_000), 10, 1200);
  farm = { ...farm, animals: { settledAt: now } };
  for (let x = 0; x < 3; x++) farm = must(farm, { type: "plow", x, y: 0 }, now).state;
  return farm;
}

describe("seasonal events", () => {
  it("run in yearly windows, including across New Year, and never overlap", () => {
    expect(activeEvent(FAIR)?.def.id).toBe("lantern_fair");
    expect(activeEvent(AFTER)).toBeNull();
    expect(activeEvent(Date.UTC(2027, 0, 2))?.def.id).toBe("frostberry_festival");
    expect(activeEvent(Date.UTC(2027, 0, 2))?.edition).toBe(2026);
    expect(nextEvent(AFTER).def.id).toBe("frostberry_festival");
    for (const a of EVENTS) {
      for (const b of EVENTS) {
        if (a === b) continue;
        const wa = eventWindow(a, 2026);
        const wb = eventWindow(b, 2026);
        expect(wa.end <= wb.start || wb.end <= wa.start).toBe(true);
      }
    }
  });

  it("allow the event crop only while the event runs", () => {
    const cmd = { type: "plant", x: 0, y: 0, cropId: "lantern_gourd" } as const;
    expect(applyCommand(field(AFTER), cmd, { now: AFTER })).toMatchObject({
      ok: false,
      error: { code: "OUT_OF_SEASON" },
    });
    must(field(FAIR), cmd, FAIR);
  });

  it("earn tokens from harvests (triple for the event crop) and spend them in the shop", () => {
    let farm = field(FAIR);
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "lantern_gourd" }, FAIR).state;
    farm = must(farm, { type: "plant", x: 1, y: 0, cropId: "clover_sprout" }, FAIR).state;
    farm = must(farm, { type: "harvest", x: 1, y: 0 }, FAIR + 3 * 60_000).state;
    const later = FAIR + 4 * HOUR + 60_000;
    farm = must(farm, { type: "harvest", x: 0, y: 0 }, later).state;
    expect(tokensNow(farm, later)).toBe(2 * 3 + 1);

    const shopping = {
      ...farm,
      events: { lantern_fair: { edition: 2026, tokens: 60, settled: false } },
    };
    const bought = must(
      shopping,
      { type: "buyEventItem", eventId: "lantern_fair", defId: "jack_sentinel" },
      later,
    );
    expect(bought.state.inventory.items.jack_sentinel).toBe(1);
    expect(tokensNow(bought.state, later)).toBe(0);
    expect(
      applyCommand(
        bought.state,
        { type: "buyEventItem", eventId: "lantern_fair", defId: "jack_sentinel" },
        { now: later },
      ),
    ).toMatchObject({ ok: false, error: { code: "NOT_ENOUGH", currency: "tokens" } });
  });

  it("turn leftover tokens into coins once, after the event ends", () => {
    const farm = {
      ...withLevel(emptyFarm(AFTER, 0), 10, 1200),
      events: { lantern_fair: { edition: 2026, tokens: 30, settled: false } },
    };
    const settled = must(farm, { type: "settle" }, AFTER);
    expect(settled.state.wallet.coins).toBe(30 * TOKEN_COIN_VALUE);
    expect(settled.events).toContainEqual({
      t: "eventSettled",
      eventId: "lantern_fair",
      tokens: 30,
      coins: 150,
    });
    const again = must(settled.state, { type: "settle" }, AFTER + DAY);
    expect(again.state.wallet.coins).toBe(30 * TOKEN_COIN_VALUE);
  });

  it("start Mayor Hollis's fair questline only during the fair", () => {
    const quiet = must(withLevel(emptyFarm(AFTER), 6, 330), { type: "settle" }, AFTER).state;
    expect(quiet.quests.active.hollis_lanterns).toBeUndefined();
    const fair = must(withLevel(emptyFarm(FAIR), 6, 330), { type: "settle" }, FAIR).state;
    expect(fair.quests.active.hollis_lanterns).toBeDefined();
  });

  it("is off before the events level", () => {
    let farm = withLevel(emptyFarm(FAIR, 1000), 3, 60);
    farm = must(farm, { type: "plow", x: 0, y: 0 }, FAIR).state;
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, FAIR).state;
    farm = must(farm, { type: "harvest", x: 0, y: 0 }, FAIR + HOUR).state;
    expect(tokensNow(farm, FAIR + HOUR)).toBe(0);
    void T0;
  });
});
