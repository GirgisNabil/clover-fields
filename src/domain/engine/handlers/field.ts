import { manuredSale } from "../../catalog/balance";
import type { CropId } from "../../catalog/crops";
import { EVENT_CROP_TOKENS } from "../../catalog/events";
import { recipeXp } from "../../catalog/recipes";
import { getBuilding, getCrop, getProducer } from "../../catalog/registry";
import { BEGINNER_LEVEL, PLOW_COST, PLOW_XP } from "../../constants";
import { tryFind } from "../../rules/collections";
import { collectRolls, cropHarvestDrops, isPollinated, plowRolls } from "../../rules/drops";
import { activeEvent, earnTokens } from "../../rules/events";
import { objectAt } from "../../rules/grid";
import { recordHarvest } from "../../rules/mastery";
import { addMaterial } from "../../rules/materials";
import { bumpStat, credit, grantXp } from "../../rules/progression";
import { cropStage, producerStatus } from "../../rules/time";
import type { FieldCommand } from "../../types/commands";
import type { Ms } from "../../types/ids";
import type { BuildingObject, FarmState, PlotObject, ProducerObject } from "../../types/state";
import { newObjectId, notEnoughCoins, type PlanContext, type Step, tile } from "../step";

type Plow = Extract<FieldCommand, { type: "plow" }>;
type Plant = Extract<FieldCommand, { type: "plant" }>;
type Harvest = Extract<FieldCommand, { type: "harvest" }>;
type CollectAnimal = Extract<FieldCommand, { type: "collectAnimal" }>;

const outOfBounds = (state: FarmState, x: number, y: number) =>
  x < 0 || y < 0 || x >= state.land.size || y >= state.land.size;

export function planPlow(state: FarmState, cmd: Plow, { now }: PlanContext): Step {
  if (outOfBounds(state, cmd.x, cmd.y)) return { code: "OUT_OF_BOUNDS" };
  const existing = objectAt(state, cmd.x, cmd.y);
  let clearedWithered = false;
  if (existing) {
    if (existing.kind !== "plot") return { code: "OCCUPIED", by: existing.id };
    if (existing.soil === "plowed") return { code: "WRONG_STATE" };
    if (existing.soil === "planted") {
      const stage = existing.crop
        ? cropStage(existing.id, existing.crop, state.meta.witherSalt, now).stage
        : "withered";
      if (stage !== "withered") return { code: "WRONG_STATE" };
      clearedWithered = true;
    }
  }
  const broke = notEnoughCoins(state, PLOW_COST);
  if (broke) return broke;

  return (draft, emit) => {
    const at = tile(cmd.x, cmd.y);
    let plotId = existing?.id;
    if (plotId) {
      const plot = draft.objects[plotId] as PlotObject;
      plot.soil = "plowed";
      plot.crop = null;
    } else {
      plotId = newObjectId(draft);
      draft.objects[plotId] = {
        kind: "plot",
        id: plotId,
        defId: "plot",
        x: cmd.x,
        y: cmd.y,
        rot: 0,
        placedAt: now,
        soil: "plowed",
        crop: null,
      };
    }
    emit({ t: "plowed", at, plotId, clearedWithered });
    credit(draft, -PLOW_COST, emit, "plow", at);
    grantXp(draft, PLOW_XP, emit, "plow", at);
    bumpStat(draft, "plow");
    tryFind(draft, { kind: "plow" }, plowRolls(draft), emit, at);
    if (clearedWithered) bumpStat(draft, "wither:lost");
  };
}

export function planPlant(state: FarmState, cmd: Plant, { now }: PlanContext): Step {
  if (outOfBounds(state, cmd.x, cmd.y)) return { code: "OUT_OF_BOUNDS" };
  const def = getCrop(cmd.cropId);
  if (!def) return { code: "UNKNOWN_DEF" };
  const plot = objectAt(state, cmd.x, cmd.y);
  if (plot?.kind !== "plot" || plot.soil !== "plowed") return { code: "WRONG_STATE" };
  if (state.progress.level < def.unlockLevel) return { code: "LOCKED", level: def.unlockLevel };
  if (def.event && activeEvent(now)?.def.id !== def.event) return { code: "OUT_OF_SEASON" };
  const broke = notEnoughCoins(state, def.seedCost);
  if (broke) return broke;

  return (draft, emit) => {
    const at = tile(cmd.x, cmd.y);
    const target = draft.objects[plot.id] as PlotObject;
    target.soil = "planted";
    target.crop = {
      cropId: def.id as CropId,
      plantedAt: now,
      revivedAt: null,
      witherProof: draft.progress.level < BEGINNER_LEVEL,
      fertilized: false,
      manure: null,
    };
    emit({ t: "planted", at, plotId: plot.id, cropId: def.id });
    credit(draft, -def.seedCost, emit, "seed", at);
    grantXp(draft, def.plantXp, emit, "seed", at);
    bumpStat(draft, "plant");
  };
}

export function planHarvest(state: FarmState, cmd: Harvest, { now }: PlanContext): Step {
  if (outOfBounds(state, cmd.x, cmd.y)) return { code: "OUT_OF_BOUNDS" };
  const obj = objectAt(state, cmd.x, cmd.y);
  if (!obj) return { code: "NO_TARGET" };
  if (cmd.expect && obj.id !== cmd.expect) return { code: "TARGET_CHANGED" };

  switch (obj.kind) {
    case "plot":
      return planCropHarvest(state, obj, now);
    case "animal":
    case "tree":
      return planProducerHarvest(obj, now);
    case "building":
      return planBuildingCollect(obj, now);
    case "decoration":
    case "vehicle":
      return { code: "NO_TARGET" };
  }
}

function planCropHarvest(state: FarmState, plot: PlotObject, now: Ms): Step {
  if (plot.soil !== "planted" || !plot.crop) return { code: "NO_TARGET" };
  const crop = plot.crop;
  const stage = cropStage(plot.id, crop, state.meta.witherSalt, now);
  if (stage.stage === "growing") return { code: "NOT_READY", readyAt: stage.ripeAt };
  if (stage.stage === "withered") return { code: "WITHERED" };
  const def = getCrop(crop.cropId);
  if (!def) return { code: "UNKNOWN_DEF" };

  const coins = crop.manure ? manuredSale(def.sale) : def.sale;
  const pollinated = isPollinated(state, plot.x, plot.y);

  return (draft, emit) => {
    const at = tile(plot.x, plot.y);
    const target = draft.objects[plot.id] as PlotObject;
    target.soil = "fallow";
    target.crop = null;
    emit({
      t: "harvested",
      at,
      objectId: plot.id,
      defId: def.id,
      coins,
      xp: 0,
      count: 1,
    });
    credit(draft, coins, emit, "harvest", at);
    bumpStat(draft, "harvest:crop");
    bumpStat(draft, `harvest:${def.id}`);
    bumpStat(draft, "coins:earned", coins);
    if (crop.manure) bumpStat(draft, "harvest:manured");
    earnTokens(draft, Math.max(1, def.plantXp) * (def.event ? EVENT_CROP_TOKENS : 1), emit, now);
    const rolls = cropHarvestDrops(draft, crop.cropId, crop.fertilized, emit, at, pollinated);
    tryFind(
      draft,
      { kind: "crop", shape: def.look.shape, growMs: def.growMs },
      rolls.find,
      emit,
      at,
    );
    recordHarvest(draft, crop.cropId, emit, at, crop.fertilized ? 2 : 1);
  };
}

/** Collects a free-roaming animal by id, wherever it is. */
export function planCollectAnimal(
  state: FarmState,
  cmd: CollectAnimal,
  { now }: PlanContext,
): Step {
  const obj = state.objects[cmd.id];
  if (obj?.kind !== "animal") return { code: "NO_TARGET" };
  return planProducerHarvest(obj, now);
}

function planProducerHarvest(obj: ProducerObject, now: Ms): Step {
  const def = getProducer(obj.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  const status = producerStatus(obj.cycleStart, def.cycleMs, now);
  if (!status.ready) return { code: "NOT_READY", readyAt: status.readyAt };

  return (draft, emit) => {
    const at = tile(obj.x, obj.y);
    const target = draft.objects[obj.id] as ProducerObject;
    // Collecting late restarts the cycle now; missed cycles are not banked.
    target.cycleStart = now;
    emit({
      t: "harvested",
      at,
      objectId: obj.id,
      defId: def.id,
      coins: def.payout,
      xp: 0,
      count: 1,
    });
    credit(draft, def.payout, emit, "harvest", at);
    if (def.material) addMaterial(draft, def.material, 1, emit, at);
    bumpStat(draft, `harvest:${def.kind}`);
    bumpStat(draft, `collect:${def.kind}`);
    tryFind(draft, { kind: def.kind }, collectRolls(draft), emit, at);
    earnTokens(draft, 1, emit, now);
    bumpStat(draft, `harvest:${def.id}`);
    bumpStat(draft, "coins:earned", def.payout);
  };
}

function planBuildingCollect(building: BuildingObject, now: Ms): Step {
  const def = getBuilding(building.defId);
  if (def?.role.type === "craft") return planCraftCollect(building, now);
  if (def?.role.type !== "housing") return { code: "NO_TARGET" };
  if (building.occupants.length === 0) return { code: "NO_TARGET" };
  let readyAt = Infinity;
  const ready: number[] = [];
  let coins = 0;
  building.occupants.forEach((occupant, index) => {
    const producer = getProducer(occupant.defId);
    if (!producer) return;
    const status = producerStatus(occupant.cycleStart, producer.cycleMs, now);
    if (status.ready) {
      ready.push(index);
      coins += producer.payout;
    } else {
      readyAt = Math.min(readyAt, status.readyAt);
    }
  });
  if (ready.length === 0) return { code: "NOT_READY", readyAt };

  return (draft, emit) => {
    const at = tile(building.x, building.y);
    const target = draft.objects[building.id] as BuildingObject;
    for (const index of ready) {
      const occupant = target.occupants[index];
      if (!occupant) continue;
      occupant.cycleStart = now;
      bumpStat(draft, `harvest:${occupant.defId}`);
      bumpStat(draft, `collect:${getProducer(occupant.defId)?.kind ?? "animal"}`);
      const material = getProducer(occupant.defId)?.material;
      if (material) addMaterial(draft, material, 1, emit, at);
    }
    emit({
      t: "harvested",
      at,
      objectId: building.id,
      defId: building.defId,
      coins,
      xp: 0,
      count: ready.length,
    });
    credit(draft, coins, emit, "harvest", at);
    bumpStat(draft, "harvest:building", ready.length);
    // Orchards find orchard keepsakes; every other home finds barnyard ones.
    const source =
      def.role.type === "housing" && def.role.accepts === "orchard" ? "tree" : "animal";
    tryFind(draft, { kind: source }, collectRolls(draft), emit, at);
    earnTokens(draft, ready.length, emit, now);
    bumpStat(draft, "coins:earned", coins);
  };
}

/** Collects every finished crafting job in a building. */
function planCraftCollect(building: BuildingObject, now: Ms): Step {
  if (building.jobs.length === 0) return { code: "NO_TARGET" };
  const done = building.jobs.filter((job) => job.readyAt <= now);
  if (done.length === 0) {
    return { code: "NOT_READY", readyAt: Math.min(...building.jobs.map((j) => j.readyAt)) };
  }
  return (draft, emit) => {
    const at = tile(building.x, building.y);
    const target = draft.objects[building.id] as BuildingObject;
    target.jobs = target.jobs.filter((job) => job.readyAt > now);
    const outputs: Record<string, number> = {};
    let xp = 0;
    for (const job of done) {
      outputs[job.recipeId] = (outputs[job.recipeId] ?? 0) + 1;
      xp += recipeXp(job.recipeId);
      bumpStat(draft, "craft:done");
      bumpStat(draft, `craft:${job.recipeId}`);
    }
    emit({ t: "crafted", buildingId: building.id, outputs, at });
    tryFind(draft, { kind: "craft" }, collectRolls(draft), emit, at);
    earnTokens(draft, done.length, emit, now);
    for (const [id, n] of Object.entries(outputs)) addMaterial(draft, id, n, emit, at);
    grantXp(draft, xp, emit, "craft", at);
  };
}
