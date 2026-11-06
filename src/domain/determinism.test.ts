import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MINUTE } from "./constants";
import { applyCommand } from "./engine/apply";
import { hash32, toUnit } from "./rng/hash";
import { loadEnvelope, makeEnvelope } from "./schema/save";
import { emptyFarm, freshFarm, T0, withLevel } from "./testing";
import type { Command } from "./types/commands";
import type { FarmState } from "./types/state";

function replay(seed: number): FarmState {
  let farm = withLevel(emptyFarm(T0, 2000), 2, 15);
  for (let i = 0; i < 200; i++) {
    const r = (k: number) => toUnit(hash32("replay", seed, i, k));
    const x = Math.floor(r(1) * 12);
    const y = Math.floor(r(2) * 12);
    const kind = r(3);
    const cmd: Command =
      kind < 0.35
        ? { type: "plow", x, y }
        : kind < 0.7
          ? { type: "plant", x, y, cropId: r(4) < 0.5 ? "clover_sprout" : "button_carrot" }
          : { type: "harvest", x, y };
    const result = applyCommand(farm, cmd, { now: T0 + i * MINUTE });
    if (result.ok) farm = result.state;
  }
  return farm;
}

describe("determinism", () => {
  it("replays a command log to the same farm", () => {
    const a = replay(7);
    const b = replay(7);
    expect(a).toEqual(b);
    expect(Object.keys(a.objects).length).toBeGreaterThan(10);
  });

  it("never mutates its input", () => {
    const farm = freshFarm();
    const snapshot = structuredClone(farm);
    applyCommand(farm, { type: "harvest", x: 2, y: 4 }, { now: T0 });
    applyCommand(farm, { type: "plow", x: 0, y: 0 }, { now: T0 });
    expect(farm).toEqual(snapshot);
  });

  it("does not let time run backwards", () => {
    const farm = { ...freshFarm(), meta: { ...freshFarm().meta, lastNow: T0 + 10 * MINUTE } };
    const result = applyCommand(farm, { type: "plow", x: 0, y: 0 }, { now: T0 });
    if (!result.ok) throw new Error("plow failed");
    expect(result.state.meta.lastNow).toBe(T0 + 10 * MINUTE);
    const plot = Object.values(result.state.objects).find((o) => o.x === 0 && o.y === 0);
    expect(plot?.placedAt).toBe(T0 + 10 * MINUTE);
  });
});

describe("purity", () => {
  it("keeps clocks, randomness and browser globals out of src/domain", () => {
    const banned = /\b(Date\.now|Math\.random|performance\.now|window\.|document\.|localStorage)\b/;
    const root = join(process.cwd(), "src/domain");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name) && name !== "testing.ts") {
          if (banned.test(readFileSync(path, "utf8"))) offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe("saves", () => {
  it("round-trip through the envelope and schema", () => {
    const farm = replay(3);
    const loaded = loadEnvelope(JSON.parse(JSON.stringify(makeEnvelope(farm, 12, T0))));
    expect(loaded).toMatchObject({ ok: true, rev: 12, notes: [] });
    if (loaded.ok) expect(loaded.state).toEqual(farm);
  });

  it("refuse newer versions and junk", () => {
    expect(loadEnvelope({ ...makeEnvelope(freshFarm(), 1, T0), v: 99 })).toMatchObject({
      ok: false,
      reason: "too-new",
    });
    expect(loadEnvelope("nope")).toMatchObject({ ok: false, reason: "not-a-save" });
    const broken = makeEnvelope(freshFarm(), 1, T0);
    expect(loadEnvelope({ ...broken, state: { v: 1 } })).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });

  it("drop items the catalog no longer knows", () => {
    const farm = freshFarm();
    const strange = {
      ...farm,
      objects: {
        ...farm.objects,
        o900: {
          kind: "decoration",
          id: "o900",
          defId: "retired_gnome",
          x: 0,
          y: 0,
          rot: 0,
          placedAt: T0,
        },
      },
      inventory: { items: { ...farm.inventory.items, retired_hat: 2 } },
    } as FarmState;
    const loaded = loadEnvelope(makeEnvelope(strange, 1, T0));
    if (!loaded.ok) throw new Error("load failed");
    expect(loaded.state.objects).not.toHaveProperty("o900");
    expect(loaded.state.inventory.items).not.toHaveProperty("retired_hat");
    expect(loaded.notes).toHaveLength(2);
  });
});
