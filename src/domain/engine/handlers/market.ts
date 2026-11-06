import { EXPANSIONS } from "../../catalog/expansions";
import { FEATURE_LEVEL } from "../../catalog/levels";
import {
  getBuilding,
  getConsumable,
  getPlaceable,
  getProducer,
  getVehicle,
  marketTabOf,
  sellValue,
  tabUnlockLevel,
} from "../../catalog/registry";
import type { FeatureId, PlaceableDef, Price } from "../../catalog/types";
import { FUEL, settleFuel } from "../../rules/fuel";
import { canPlace } from "../../rules/grid";
import {
  addItem,
  inventoryCapacity,
  inventoryUsed,
  removeItem,
  takesShedSlot,
} from "../../rules/inventory";
import { addMaterial, hasMaterials, removeMaterial } from "../../rules/materials";
import { bumpStat, credit, creditClovers, grantXp } from "../../rules/progression";
import { cropStage } from "../../rules/time";
import type { InstantCommand } from "../../types/commands";
import type { DomainError } from "../../types/errors";
import type { Emit } from "../../types/events";
import type { ObjectId, Rotation } from "../../types/ids";
import type { BuildingObject, FarmObject, FarmState, VehicleObject } from "../../types/state";
import {
  newObjectId,
  notEnoughClovers,
  notEnoughCoins,
  type PlanContext,
  type Step,
  tile,
} from "../step";

type Cmd<T extends InstantCommand["type"]> = Extract<InstantCommand, { type: T }>;

const featureLocked = (state: FarmState, feature: FeatureId): DomainError | null =>
  state.progress.level < FEATURE_LEVEL[feature]
    ? { code: "FEATURE_LOCKED", level: FEATURE_LEVEL[feature] }
    : null;

function canAfford(state: FarmState, price: Price): DomainError | null {
  return "coins" in price
    ? notEnoughCoins(state, price.coins)
    : notEnoughClovers(state, price.clovers);
}

function pay(draft: FarmState, price: Price, emit: Emit, at?: { x: number; y: number }) {
  if ("coins" in price) credit(draft, -price.coins, emit, "buy", at);
  else creditClovers(draft, -price.clovers, emit, "buy");
}

/** Builds the object a placeable def becomes on the farm. */
function makeObject(
  def: PlaceableDef,
  id: ObjectId,
  x: number,
  y: number,
  rot: Rotation,
  now: number,
  cycleStart = now,
): FarmObject {
  const base = { id, x, y, rot, placedAt: now };
  switch (def.kind) {
    case "animal":
      return { ...base, kind: "animal", defId: def.id as never, cycleStart };
    case "tree":
      return { ...base, kind: "tree", defId: def.id as never, cycleStart };
    case "building":
      return {
        ...base,
        kind: "building",
        defId: def.id as never,
        tier: 1,
        occupants: [],
        jobs: [],
      };
    case "decoration":
      return { ...base, kind: "decoration", defId: def.id };
    case "vehicle":
      return { ...base, kind: "vehicle", defId: def.id as never, tier: 1 };
  }
}

export function planBuyPlace(state: FarmState, cmd: Cmd<"buyPlace">, { now }: PlanContext): Step {
  const def = getPlaceable(cmd.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  const tab = marketTabOf(def);
  if (!tab || !def.price) return { code: "NOT_FOR_SALE" };
  const tabLevel = tabUnlockLevel(tab);
  if (state.progress.level < tabLevel) return { code: "FEATURE_LOCKED", level: tabLevel };
  if (state.progress.level < def.unlockLevel) return { code: "LOCKED", level: def.unlockLevel };
  const blocked = canPlace(state, def.id, cmd.x, cmd.y, cmd.rot);
  if (blocked) return blocked;
  const price = def.price;
  const broke = canAfford(state, price);
  if (broke) return broke;
  return (draft, emit) => {
    const id = newObjectId(draft);
    const at = tile(cmd.x, cmd.y);
    draft.objects[id] = makeObject(def, id, cmd.x, cmd.y, cmd.rot, now);
    emit({ t: "placed", objectId: id, defId: def.id, at, rot: cmd.rot, source: "market" });
    pay(draft, price, emit, at);
    grantXp(draft, def.xpOnBuy, emit, "buy", at);
    bumpStat(draft, `buy:${def.kind}`);
  };
}

export function planBuyItem(state: FarmState, cmd: Cmd<"buyItem">, { now }: PlanContext): Step {
  const def = getConsumable(cmd.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if (state.progress.level < def.unlockLevel) return { code: "LOCKED", level: def.unlockLevel };
  const qty = Math.max(1, Math.floor(cmd.qty));
  const price: Price =
    "coins" in def.price ? { coins: def.price.coins * qty } : { clovers: def.price.clovers * qty };
  const broke = canAfford(state, price);
  if (broke) return broke;
  return (draft, emit) => {
    pay(draft, price, emit);
    if (def.effect.type === "coins") {
      credit(draft, def.effect.amount * qty, emit, "item");
    } else if (def.effect.type === "material") {
      addMaterial(draft, def.effect.id, def.effect.amount * qty, emit);
    } else if (def.effect.type === "fuel") {
      settleFuel(draft, now);
      const before = draft.fuel.units;
      draft.fuel.units = Math.min(FUEL.hardMax, before + def.effect.units * qty);
      emit({
        t: "fuel",
        units: draft.fuel.units,
        delta: draft.fuel.units - before,
        reason: "item",
      });
    } else {
      addItem(draft, def.id, qty);
      emit({ t: "inventory", defId: def.id, delta: qty });
    }
  };
}

export function planMove(state: FarmState, cmd: Cmd<"move">, { now }: PlanContext): Step {
  const obj = state.objects[cmd.id];
  if (!obj) return { code: "NO_TARGET" };
  const blocked = canPlace(
    state,
    obj.defId,
    cmd.x,
    cmd.y,
    obj.kind === "plot" ? 0 : cmd.rot,
    obj.id,
  );
  if (blocked) return blocked;
  return (draft, emit) => {
    const target = draft.objects[cmd.id];
    if (!target) return;
    const from = tile(target.x, target.y);
    target.x = cmd.x;
    target.y = cmd.y;
    target.rot = target.kind === "plot" ? 0 : cmd.rot;
    target.placedAt = now;
    emit({ t: "moved", objectId: target.id, from, to: tile(cmd.x, cmd.y), rot: target.rot });
  };
}

export function planSell(state: FarmState, cmd: Cmd<"sell">): Step {
  const obj = state.objects[cmd.id];
  if (!obj) return { code: "NO_TARGET" };
  let refund = 0;
  if (obj.kind !== "plot") {
    const locked = featureLocked(state, "sell");
    if (locked) return locked;
    const def = getPlaceable(obj.defId);
    if (!def) return { code: "UNKNOWN_DEF" };
    if (!def.sellable) return { code: "NOT_SELLABLE" };
    if (obj.kind === "building" && obj.occupants.length > 0) return { code: "NOT_EMPTY" };
    refund = sellValue(def);
  }
  return (draft, emit) => {
    const at = tile(obj.x, obj.y);
    delete draft.objects[cmd.id];
    emit({ t: "removed", objectId: obj.id, defId: obj.defId, to: "sold", refund, at });
    credit(draft, refund, emit, "sell", at);
    bumpStat(draft, "sell");
  };
}

export function planStore(state: FarmState, cmd: Cmd<"store">): Step {
  const obj = state.objects[cmd.id];
  if (!obj) return { code: "NO_TARGET" };
  if (obj.kind === "plot") return { code: "NOT_STORABLE" };
  const locked = featureLocked(state, "store");
  if (locked) return locked;
  const def = getPlaceable(obj.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if (!def.storable) return { code: "NOT_STORABLE" };
  if (takesShedSlot(def.id) && inventoryUsed(state) >= inventoryCapacity(state)) {
    return { code: "INVENTORY_FULL" };
  }
  return (draft, emit) => {
    delete draft.objects[cmd.id];
    addItem(draft, def.id);
    emit({
      t: "removed",
      objectId: obj.id,
      defId: def.id,
      to: "storage",
      refund: 0,
      at: tile(obj.x, obj.y),
    });
    emit({ t: "inventory", defId: def.id, delta: 1 });
  };
}

export function planPlaceStored(
  state: FarmState,
  cmd: Cmd<"placeStored">,
  { now }: PlanContext,
): Step {
  const def = getPlaceable(cmd.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if ((state.inventory.items[def.id] ?? 0) < 1) return { code: "NONE_OWNED" };
  const blocked = canPlace(state, def.id, cmd.x, cmd.y, cmd.rot);
  if (blocked) return blocked;
  return (draft, emit) => {
    const id = newObjectId(draft);
    const at = tile(cmd.x, cmd.y);
    draft.objects[id] = makeObject(def, id, cmd.x, cmd.y, cmd.rot, now);
    removeItem(draft, def.id);
    emit({ t: "placed", objectId: id, defId: def.id, at, rot: cmd.rot, source: "storage" });
    emit({ t: "inventory", defId: def.id, delta: -1 });
  };
}

export function planExpand(state: FarmState, cmd: Cmd<"expand">): Step {
  const next = EXPANSIONS[state.land.expansionIndex + 1];
  if (!next) return { code: "MAX_LAND" };
  if (state.progress.level < next.level) return { code: "LOCKED", level: next.level };
  const price = cmd.pay === "clovers" ? next.alt : next.price;
  const broke = canAfford(state, price);
  if (broke) return broke;
  return (draft, emit) => {
    pay(draft, price, emit);
    draft.land.size = next.size;
    draft.land.expansionIndex = next.index;
    emit({ t: "landExpanded", size: next.size });
  };
}

export function planUseItem(state: FarmState, cmd: Cmd<"useItem">, { now }: PlanContext): Step {
  const def = getConsumable(cmd.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if ((state.inventory.items[def.id] ?? 0) < 1) return { code: "NONE_OWNED" };
  if (def.effect.type !== "unwither") return { code: "WRONG_STATE" };
  const withered = Object.values(state.objects).filter(
    (o) =>
      o.kind === "plot" &&
      o.crop !== null &&
      cropStage(o.id, o.crop, state.meta.witherSalt, now).stage === "withered",
  );
  if (withered.length === 0) return { code: "NOTHING_TO_DO" };
  return (draft, emit) => {
    for (const plot of withered) {
      const target = draft.objects[plot.id];
      if (target?.kind === "plot" && target.crop) target.crop.revivedAt = now;
    }
    removeItem(draft, def.id);
    emit({ t: "revived", plotIds: withered.map((p) => p.id) });
    emit({ t: "inventory", defId: def.id, delta: -1 });
  };
}

export function planUpgrade(state: FarmState, cmd: Cmd<"upgrade">): Step {
  const obj = state.objects[cmd.id];
  if (obj?.kind === "vehicle") return planVehicleUpgrade(state, obj);
  if (obj?.kind !== "building") return { code: "NO_TARGET" };
  const def = getBuilding(obj.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if (obj.tier >= 3) return { code: "MAX_TIER" };
  const upgrade = def.upgrades[obj.tier - 1];
  if (!upgrade) return { code: "MAX_TIER" };
  if (state.progress.level < upgrade.level) return { code: "LOCKED", level: upgrade.level };
  const broke = canAfford(state, upgrade.price);
  if (broke) return broke;
  return (draft, emit) => {
    const target = draft.objects[cmd.id] as BuildingObject;
    target.tier = (target.tier + 1) as 2 | 3;
    pay(draft, upgrade.price, emit, tile(target.x, target.y));
    emit({
      t: "upgraded",
      objectId: target.id,
      tier: target.tier,
      capacity: def.capacity[target.tier - 1] ?? 0,
    });
  };
}

export function planHouse(state: FarmState, cmd: Cmd<"house">): Step {
  const obj = state.objects[cmd.id];
  if (obj?.kind !== "animal" && obj?.kind !== "tree") return { code: "NO_TARGET" };
  const building = state.objects[cmd.buildingId];
  if (building?.kind !== "building") return { code: "NO_TARGET" };
  const producer = getProducer(obj.defId);
  const def = getBuilding(building.defId);
  if (!producer || !def) return { code: "UNKNOWN_DEF" };
  if (def.role.type !== "housing" || def.role.accepts !== producer.housing) {
    return { code: "WRONG_HOUSING" };
  }
  if (building.occupants.length >= (def.capacity[building.tier - 1] ?? 0)) {
    return { code: "BUILDING_FULL" };
  }
  return (draft, emit) => {
    const target = draft.objects[cmd.buildingId] as BuildingObject;
    target.occupants.push({ id: obj.id, defId: obj.defId, cycleStart: obj.cycleStart });
    delete draft.objects[obj.id];
    emit({
      t: "removed",
      objectId: obj.id,
      defId: obj.defId,
      to: "building",
      refund: 0,
      at: tile(obj.x, obj.y),
    });
  };
}

export function planRelease(state: FarmState, cmd: Cmd<"release">, { now }: PlanContext): Step {
  const building = state.objects[cmd.buildingId];
  if (building?.kind !== "building") return { code: "NO_TARGET" };
  const occupant = building.occupants.find((o) => o.id === cmd.occupantId);
  if (!occupant) return { code: "NO_TARGET" };
  const def = getPlaceable(occupant.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  const blocked = canPlace(state, def.id, cmd.x, cmd.y, cmd.rot);
  if (blocked) return blocked;
  return (draft, emit) => {
    const target = draft.objects[cmd.buildingId] as BuildingObject;
    target.occupants = target.occupants.filter((o) => o.id !== occupant.id);
    draft.objects[occupant.id] = makeObject(
      def,
      occupant.id,
      cmd.x,
      cmd.y,
      cmd.rot,
      now,
      occupant.cycleStart,
    );
    emit({
      t: "placed",
      objectId: occupant.id,
      defId: def.id,
      at: tile(cmd.x, cmd.y),
      rot: cmd.rot,
      source: "building",
    });
  };
}

function planVehicleUpgrade(state: FarmState, obj: VehicleObject): Step {
  const def = getVehicle(obj.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if (obj.tier >= 2) return { code: "MAX_TIER" };
  const { upgrade } = def;
  if (state.progress.level < upgrade.level) return { code: "LOCKED", level: upgrade.level };
  const missing = hasMaterials(state, upgrade.materials);
  if (missing) {
    return {
      code: "NOT_ENOUGH_ITEMS",
      id: missing[0],
      need: missing[1],
      have: state.materials[missing[0]] ?? 0,
    };
  }
  const broke = canAfford(state, upgrade.price);
  if (broke) return broke;
  return (draft, emit) => {
    const target = draft.objects[obj.id] as VehicleObject;
    target.tier = 2;
    pay(draft, upgrade.price, emit, tile(target.x, target.y));
    for (const [id, n] of Object.entries(upgrade.materials)) removeMaterial(draft, id, n, emit);
    emit({ t: "upgraded", objectId: target.id, tier: 2, capacity: def.area[1] });
    bumpStat(draft, "vehicle:upgrade");
  };
}
