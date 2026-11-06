import { describe, expect, it } from "vitest";
import { MINUTE } from "../constants";
import { applyCommand } from "../engine/apply";
import { hash32, toUnit } from "../rng/hash";
import { displayWallet } from "../selectors";
import { emptyFarm, freshFarm, must, T0, withLevel } from "../testing";
import type { FieldCommand } from "../types/commands";
import {
  emptyProjection,
  type Projection,
  performHead,
  projectedState,
  type QueueEntry,
  refold,
  tryExtend,
} from "./projection";

const ctx = { now: T0 };
let qid = 0;
const entry = (cmd: FieldCommand): QueueEntry => ({ qid: `q${qid++}`, cmd, enqueuedAt: T0 });

function extendAll(p: Projection, cmds: FieldCommand[]) {
  const results = cmds.map((cmd) => {
    const r = tryExtend(p, cmd, ctx);
    if (r.ok) p = r.p;
    return r.ok ? "ok" : r.error.code;
  });
  return { p, results };
}

describe("queue projection", () => {
  it("prevents spending the same coins twice", () => {
    const farm = { ...emptyFarm(), wallet: { coins: 25, clovers: 0 } };
    const { p, results } = extendAll(emptyProjection(farm), [
      { type: "plow", x: 0, y: 0 },
      { type: "plow", x: 1, y: 0 },
      { type: "plow", x: 2, y: 0 },
    ]);
    expect(results).toEqual(["ok", "ok", "NOT_ENOUGH"]);
    expect(farm.wallet.coins).toBe(25);
    expect(projectedState(p).wallet.coins).toBe(5);
  });

  it("refuses queuing the same plow twice", () => {
    const { results } = extendAll(emptyProjection(emptyFarm()), [
      { type: "plow", x: 3, y: 3 },
      { type: "plow", x: 3, y: 3 },
    ]);
    expect(results).toEqual(["ok", "WRONG_STATE"]);
  });

  it("accepts plow then plant on grass, and plants at perform time", () => {
    const farm = emptyFarm();
    const { p, results } = extendAll(emptyProjection(farm), [
      { type: "plow", x: 1, y: 1 },
      { type: "plant", x: 1, y: 1, cropId: "clover_sprout" },
    ]);
    expect(results).toEqual(["ok", "ok"]);
    const entries = [
      entry({ type: "plow", x: 1, y: 1 }),
      entry({ type: "plant", x: 1, y: 1, cropId: "clover_sprout" }),
    ];
    const first = performHead(farm, entries, { now: T0 + 1000 });
    const second = performHead(first.farm, first.kept, { now: T0 + 5000 });
    const plot = Object.values(second.farm.objects).find((o) => o.x === 1 && o.y === 1);
    expect(plot).toMatchObject({ soil: "planted", crop: { plantedAt: T0 + 5000 } });
    expect(projectedState(p).wallet.coins).toBe(second.farm.wallet.coins);
  });

  it("rejects a harvest whose crop withered on the way and drops what depended on it", () => {
    let farm = withLevel({ ...emptyFarm(), wallet: { coins: 20, clovers: 0 } }, 6, 330);
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, T0).state; // 0 coins
    const ripe = T0 + 3 * MINUTE;
    const entries = [
      entry({ type: "harvest", x: 0, y: 0 }),
      entry({ type: "plow", x: 0, y: 0 }),
      entry({ type: "plow", x: 5, y: 5 }),
    ];
    const queued = refold(farm, entries, { now: ripe });
    expect(queued.kept).toHaveLength(3);

    const late = T0 + 2 * MINUTE + 31 * MINUTE; // withered by now
    const result = performHead(farm, entries, { now: late });
    expect(result.rejected?.error.code).toBe("WITHERED");
    // With no harvest money, only one of the two plows is still affordable... and that is 0 coins.
    expect(result.kept.length + result.dropped.length).toBe(2);
    expect(result.dropped.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the incremental projection equal to a full fold over random sequences", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const rand = (i: number) => toUnit(hash32("prop", seed, i));
      let farm = withLevel(
        { ...freshFarm(), wallet: { coins: Math.floor(rand(0) * 120), clovers: 0 } },
        2,
        15,
      );
      let p = emptyProjection(farm);
      const accepted: QueueEntry[] = [];
      for (let i = 1; i <= 12; i++) {
        const x = Math.floor(rand(i * 3) * 12);
        const y = Math.floor(rand(i * 3 + 1) * 12);
        const kind = rand(i * 3 + 2);
        const cmd: FieldCommand =
          kind < 0.4
            ? { type: "plow", x, y }
            : kind < 0.8
              ? { type: "plant", x, y, cropId: "clover_sprout" }
              : { type: "harvest", x, y };
        const r = tryExtend(p, cmd, ctx);
        if (r.ok) {
          p = r.p;
          accepted.push(entry(cmd));
        }
      }
      const full = refold(farm, accepted, ctx);
      expect(full.dropped).toHaveLength(0);
      expect(projectedState(full.p)).toEqual(projectedState(p));
      expect(projectedState(p).wallet.coins).toBeGreaterThanOrEqual(0);
      // Performing everything lands on the projected wallet.
      let queue = accepted;
      while (queue.length > 0) {
        const step = performHead(farm, queue, ctx);
        farm = step.farm;
        queue = step.kept;
        expect(farm.wallet.coins).toBeGreaterThanOrEqual(0);
      }
      expect(farm.wallet.coins).toBe(projectedState(p).wallet.coins);
    }
  });

  it("shows spending at once and income only when earned", () => {
    const real = freshFarm();
    const spend = applyCommand(real, { type: "plow", x: 0, y: 0 }, ctx);
    if (!spend.ok) throw new Error("plow failed");
    expect(displayWallet(real, spend.state).coins).toBe(real.wallet.coins - 10);
    const earn = applyCommand(real, { type: "harvest", x: 2, y: 4 }, ctx);
    if (!earn.ok) throw new Error("harvest failed");
    expect(displayWallet(real, earn.state).coins).toBe(real.wallet.coins);
  });
});
