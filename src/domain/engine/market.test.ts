import { describe, expect, it } from "vitest";
import { MINUTE } from "../constants";
import { objectAt } from "../rules/grid";
import { animalAt, emptyFarm, freshFarm, must, T0, withLevel } from "../testing";
import type { BuildingObject, FarmState } from "../types/state";
import { applyCommand } from "./apply";

const at = (farm: FarmState, x: number, y: number) => objectAt(farm, x, y);
const refuse = (farm: FarmState, cmd: Parameters<typeof applyCommand>[1], now = T0) =>
  applyCommand(farm, cmd, { now });

describe("buying and placing", () => {
  it("places a decoration, charges coins and grants XP", () => {
    const farm = emptyFarm();
    const { state, events } = must(
      farm,
      { type: "buyPlace", defId: "daisy_bed", x: 1, y: 1, rot: 0 },
      T0,
    );
    expect(at(state, 1, 1)).toMatchObject({ kind: "decoration", defId: "daisy_bed" });
    expect(state.wallet.coins).toBe(farm.wallet.coins - 60);
    expect(state.progress.xp).toBe(1);
    expect(events[0]).toMatchObject({ t: "placed", source: "market" });
  });

  it("respects tab locks, item locks, collisions and clover prices", () => {
    const farm = emptyFarm();
    expect(
      refuse(farm, { type: "buyPlace", defId: "russet_hen", x: 0, y: 0, rot: 0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "FEATURE_LOCKED", level: 2 },
    });
    expect(
      refuse(farm, { type: "buyPlace", defId: "rain_barrel", x: 0, y: 0, rot: 0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "LOCKED", level: 2 },
    });
    expect(
      refuse(farm, { type: "buyPlace", defId: "tool_shed", x: 0, y: 0, rot: 0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "NOT_FOR_SALE" },
    });
    const placed = must(
      farm,
      { type: "buyPlace", defId: "daisy_bed", x: 0, y: 0, rot: 0 },
      T0,
    ).state;
    expect(
      refuse(placed, { type: "buyPlace", defId: "daisy_bed", x: 0, y: 0, rot: 0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "OCCUPIED" },
    });
    const rich = withLevel({ ...emptyFarm(), wallet: { coins: 0, clovers: 3 } }, 5, 200);
    const lantern = must(
      rich,
      { type: "buyPlace", defId: "moonlit_lantern_tree", x: 2, y: 2, rot: 0 },
      T0,
    );
    expect(lantern.state.wallet.clovers).toBe(0);
    expect(lantern.state.progress.xp).toBe(290);
  });

  it("starts producers on a fresh cycle", () => {
    const farm = withLevel(emptyFarm(), 2, 15);
    const { state } = must(farm, { type: "buyPlace", defId: "russet_hen", x: 3, y: 3, rot: 0 }, T0);
    expect(animalAt(state, 3, 3)).toMatchObject({ kind: "animal", cycleStart: T0 });
  });
});

describe("arranging", () => {
  it("moves and rotates objects, keeping crops", () => {
    const farm = freshFarm();
    const bench = must(
      withLevel({ ...farm }, 7, 500),
      { type: "buyPlace", defId: "garden_bench", x: 0, y: 9, rot: 0 },
      T0,
    ).state;
    const id = at(bench, 0, 9)?.id;
    if (!id) throw new Error("bench missing");
    const moved = must(bench, { type: "move", id, x: 0, y: 10, rot: 1 }, T0).state;
    expect(at(moved, 0, 11)?.id).toBe(id);
    expect(at(moved, 1, 10)).toBeNull();
    const plot = at(farm, 2, 4);
    if (!plot) throw new Error("plot missing");
    const plotMoved = must(farm, { type: "move", id: plot.id, x: 0, y: 0, rot: 2 }, T0).state;
    expect(at(plotMoved, 0, 0)).toMatchObject({ kind: "plot", soil: "planted", rot: 0 });
  });

  it("sells for the right refund once selling unlocks", () => {
    const farm = freshFarm();
    const hen = animalAt(farm, 8, 7);
    const shed = at(farm, 9, 0);
    if (!hen || !shed) throw new Error("starter objects missing");
    expect(refuse(farm, { type: "sell", id: hen.id })).toMatchObject({
      ok: false,
      error: { code: "FEATURE_LOCKED" },
    });
    const veteran = withLevel(farm, 5, 200);
    const sold = must(veteran, { type: "sell", id: hen.id }, T0);
    expect(sold.state.wallet.coins).toBe(farm.wallet.coins + 6);
    expect(refuse(veteran, { type: "sell", id: shed.id })).toMatchObject({
      ok: false,
      error: { code: "NOT_SELLABLE" },
    });
    const plot = at(farm, 2, 5);
    if (!plot) throw new Error("plot missing");
    expect(must(farm, { type: "sell", id: plot.id }, T0).state.wallet.coins).toBe(
      farm.wallet.coins,
    );
  });

  it("stores items in the Tool Shed and places them back without XP", () => {
    const farm = withLevel(freshFarm(), 4, 110);
    const sentinel = at(farm, 1, 4);
    if (!sentinel) throw new Error("sentinel missing");
    const stored = must(farm, { type: "store", id: sentinel.id }, T0).state;
    expect(stored.inventory.items.straw_sentinel).toBe(1);
    expect(at(stored, 1, 4)).toBeNull();
    const placed = must(
      stored,
      { type: "placeStored", defId: "straw_sentinel", x: 0, y: 11, rot: 0 },
      T0,
    ).state;
    expect(placed.inventory.items.straw_sentinel).toBeUndefined();
    expect(placed.progress.xp).toBe(110);
    expect(
      refuse(placed, { type: "placeStored", defId: "straw_sentinel", x: 1, y: 11, rot: 0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "NONE_OWNED" },
    });
  });

  it("refuses storing into a full shed", () => {
    const farm = withLevel({ ...freshFarm(), inventory: { items: { rail_fence: 20 } } }, 4, 110);
    const sentinel = at(farm, 1, 4);
    if (!sentinel) throw new Error("sentinel missing");
    expect(refuse(farm, { type: "store", id: sentinel.id })).toMatchObject({
      ok: false,
      error: { code: "INVENTORY_FULL" },
    });
  });
});

describe("housing", () => {
  it("houses matching animals, collects them together and releases them", () => {
    let farm = withLevel(emptyFarm(T0, 50_000), 6, 330);
    farm = must(farm, { type: "buyPlace", defId: "hen_house", x: 0, y: 0, rot: 0 }, T0).state;
    farm = must(farm, { type: "buyPlace", defId: "russet_hen", x: 6, y: 6, rot: 0 }, T0).state;
    farm = must(farm, { type: "buyPlace", defId: "puffwool_sheep", x: 7, y: 7, rot: 0 }, T0).state;
    const house = at(farm, 0, 0) as BuildingObject;
    const hen = animalAt(farm, 6, 6);
    const sheep = animalAt(farm, 7, 7);
    if (!hen || !sheep) throw new Error("animals missing");
    expect(refuse(farm, { type: "house", id: sheep.id, buildingId: house.id })).toMatchObject({
      ok: false,
      error: { code: "WRONG_HOUSING" },
    });
    farm = must(farm, { type: "house", id: hen.id, buildingId: house.id }, T0).state;
    expect(animalAt(farm, 6, 6)).toBeNull();
    expect((at(farm, 0, 0) as BuildingObject).occupants).toHaveLength(1);
    const collected = must(farm, { type: "harvest", x: 1, y: 1 }, T0 + 61 * MINUTE);
    expect(collected.events[0]).toMatchObject({ t: "harvested", count: 1, coins: 13 });
    const released = must(
      farm,
      { type: "release", buildingId: house.id, occupantId: hen.id, x: 9, y: 9, rot: 0 },
      T0,
    );
    expect(animalAt(released.state, 9, 9)).toMatchObject({ id: hen.id, kind: "animal" });
  });

  it("upgrades buildings by tier and level", () => {
    let farm = withLevel(emptyFarm(T0, 50_000), 6, 330);
    farm = must(farm, { type: "buyPlace", defId: "hen_house", x: 0, y: 0, rot: 0 }, T0).state;
    const id = at(farm, 0, 0)?.id;
    if (!id) throw new Error("house missing");
    expect(refuse(farm, { type: "upgrade", id })).toMatchObject({
      ok: false,
      error: { code: "LOCKED", level: 11 },
    });
    const upgraded = must(withLevel(farm, 20, 8050), { type: "upgrade", id }, T0);
    expect(upgraded.events).toContainEqual(
      expect.objectContaining({ t: "upgraded", tier: 2, capacity: 30 }),
    );
  });
});

describe("land and items", () => {
  it("expands in order, by level, with coins or clovers", () => {
    const farm = emptyFarm();
    expect(refuse(farm, { type: "expand", pay: "coins" })).toMatchObject({
      ok: false,
      error: { code: "LOCKED", level: 4 },
    });
    const expanded = must(withLevel(farm, 4, 110), { type: "expand", pay: "coins" }, T0);
    const big = expanded.state;
    expect(big.land.size).toBe(14);
    // The first expansion also earns the green Landowner ribbon (+150).
    expect(expanded.events).toContainEqual({ t: "ribbon", id: "landowner", tier: 1 });
    expect(big.wallet.coins).toBe(farm.wallet.coins - 2500 + 150);
    const viaClovers = must(
      withLevel({ ...farm, wallet: { coins: 0, clovers: 4 } }, 4, 110),
      { type: "expand", pay: "clovers" },
      T0,
    );
    expect(viaClovers.state.land.size).toBe(14);
    const maxed = { ...farm, land: { size: 26, expansionIndex: 7 } };
    expect(refuse(maxed, { type: "expand", pay: "coins" })).toMatchObject({
      ok: false,
      error: { code: "MAX_LAND" },
    });
  });

  it("revives withered crops with a tonic, and keeps the tonic when nothing withered", () => {
    let farm = withLevel({ ...emptyFarm(), inventory: { items: { unwither_tonic: 1 } } }, 6, 330);
    expect(refuse(farm, { type: "useItem", defId: "unwither_tonic" })).toMatchObject({
      ok: false,
      error: { code: "NOTHING_TO_DO" },
    });
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, T0).state;
    const late = T0 + 40 * MINUTE;
    const revived = must(farm, { type: "useItem", defId: "unwither_tonic" }, late);
    expect(revived.state.inventory.items.unwither_tonic).toBeUndefined();
    expect(must(revived.state, { type: "harvest", x: 0, y: 0 }, late).state.wallet.coins).toBe(
      revived.state.wallet.coins + 35,
    );
  });

  it("buys consumables and coin pouches", () => {
    const farm = emptyFarm();
    const tonic = must(farm, { type: "buyItem", defId: "unwither_tonic", qty: 2 }, T0).state;
    expect(tonic.inventory.items.unwither_tonic).toBe(2);
    expect(tonic.wallet.clovers).toBe(6);
    const pouch = must(farm, { type: "buyItem", defId: "coin_pouch", qty: 1 }, T0).state;
    expect(pouch.wallet.coins).toBe(farm.wallet.coins + 1000);
  });
});
