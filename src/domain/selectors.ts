import { LEVEL_XP, titleFor } from "./catalog/levels";
import { getBuilding, getCrop, getDef, getProducer, getVehicle } from "./catalog/registry";
import { MAX_LEVEL } from "./constants";
import { objectAt } from "./rules/grid";
import { inventoryCapacity, inventoryUsed } from "./rules/inventory";
import { cropStage, producerStatus } from "./rules/time";
import type { Ms } from "./types/ids";
import type { FarmObject, FarmState } from "./types/state";

export interface LevelProgress {
  level: number;
  title: string;
  xp: number;
  /** XP earned since reaching this level. */
  into: number;
  /** XP this level takes in total (0 at max level). */
  span: number;
  fraction: number;
  maxed: boolean;
}

export function levelProgress(state: FarmState): LevelProgress {
  const { level, xp } = state.progress;
  const start = LEVEL_XP[level] ?? 0;
  const next = LEVEL_XP[level + 1];
  const maxed = level >= MAX_LEVEL || next === undefined;
  const span = maxed ? 0 : next - start;
  const into = xp - start;
  return {
    level,
    title: titleFor(level),
    xp,
    into,
    span,
    fraction: maxed ? 1 : Math.min(1, into / span),
    maxed,
  };
}

/** Spending shows immediately (projected); income shows when the farmer earns it (real). */
export function displayWallet(real: FarmState, projected: FarmState) {
  return {
    coins: Math.min(real.wallet.coins, projected.wallet.coins),
    clovers: Math.min(real.wallet.clovers, projected.wallet.clovers),
    pending: projected.wallet.coins < real.wallet.coins,
  };
}

export type ObjectStatus =
  | { kind: "grass" }
  | { kind: "fallow" }
  | { kind: "plowed" }
  | {
      kind: "growing";
      name: string;
      icon: string;
      readyAt: Ms;
      progress: number;
      /** Name of the animal (or "Fertilizer") that manured it. */
      manuredBy: string | null;
    }
  | {
      kind: "ripe";
      name: string;
      icon: string;
      witherAt: Ms;
      protected: boolean;
      manuredBy: string | null;
    }
  | { kind: "withered"; name: string; icon: string }
  | {
      kind: "producer";
      name: string;
      icon: string;
      product: string;
      ready: boolean;
      readyAt: Ms;
      progress: number;
    }
  | {
      kind: "building";
      name: string;
      icon: string;
      occupants: number;
      capacity: number;
      readyCount: number;
      nextReadyAt: Ms | null;
      crafting?: true;
    }
  | { kind: "decoration"; name: string; icon: string }
  | { kind: "vehicle"; name: string; icon: string; tier: 1 | 2; area: number };

export function objectStatus(state: FarmState, obj: FarmObject | null, now: Ms): ObjectStatus {
  if (!obj) return { kind: "grass" };
  switch (obj.kind) {
    case "plot": {
      if (obj.soil === "fallow") return { kind: "fallow" };
      if (obj.soil === "plowed" || !obj.crop) return { kind: "plowed" };
      const def = getCrop(obj.crop.cropId);
      const name = def?.name ?? obj.crop.cropId;
      const icon = def?.icon ?? "🌱";
      const stage = cropStage(obj.id, obj.crop, state.meta.witherSalt, now);
      const by = obj.crop.manure?.by;
      const manuredBy = by ? (getDef(by)?.name ?? "Fertilizer") : null;
      if (stage.stage === "growing") {
        return {
          kind: "growing",
          name,
          icon,
          readyAt: stage.ripeAt,
          progress: stage.progress,
          manuredBy,
        };
      }
      if (stage.stage === "ripe") {
        return {
          kind: "ripe",
          name,
          icon,
          witherAt: stage.witherAt,
          protected: obj.crop.witherProof,
          manuredBy,
        };
      }
      return { kind: "withered", name, icon };
    }
    case "animal":
    case "tree": {
      const def = getProducer(obj.defId);
      if (!def) return { kind: "decoration", name: obj.defId, icon: "❓" };
      const s = producerStatus(obj.cycleStart, def.cycleMs, now);
      return {
        kind: "producer",
        name: def.name,
        icon: def.icon,
        product: def.product.icon,
        ready: s.ready,
        readyAt: s.readyAt,
        progress: s.progress,
      };
    }
    case "building": {
      const def = getBuilding(obj.defId);
      if (!def) return { kind: "decoration", name: obj.defId, icon: "❓" };
      let readyCount = 0;
      let nextReadyAt: Ms | null = null;
      if (def.role.type === "craft") {
        for (const job of obj.jobs) {
          if (job.readyAt <= now) readyCount++;
          else
            nextReadyAt = nextReadyAt === null ? job.readyAt : Math.min(nextReadyAt, job.readyAt);
        }
        return {
          kind: "building",
          name: def.name,
          icon: def.icon,
          occupants: obj.jobs.length,
          capacity: def.capacity[obj.tier - 1] ?? 0,
          readyCount,
          nextReadyAt,
          crafting: true,
        };
      }
      for (const occupant of obj.occupants) {
        const producer = getProducer(occupant.defId);
        if (!producer) continue;
        const s = producerStatus(occupant.cycleStart, producer.cycleMs, now);
        if (s.ready) readyCount++;
        else nextReadyAt = nextReadyAt === null ? s.readyAt : Math.min(nextReadyAt, s.readyAt);
      }
      return {
        kind: "building",
        name: def.name,
        icon: def.icon,
        occupants: obj.occupants.length,
        capacity:
          def.role.type === "storage"
            ? inventoryCapacity(state)
            : (def.capacity[obj.tier - 1] ?? 0),
        readyCount,
        nextReadyAt,
      };
    }
    case "vehicle": {
      const def = getVehicle(obj.defId);
      return {
        kind: "vehicle",
        name: def?.name ?? obj.defId,
        icon: def?.icon ?? "🚜",
        tier: obj.tier,
        area: def?.area[obj.tier - 1] ?? 2,
      };
    }
    case "decoration": {
      const def = getDef(obj.defId);
      return { kind: "decoration", name: def?.name ?? obj.defId, icon: def?.icon ?? "❓" };
    }
  }
}

export function tileStatus(state: FarmState, x: number, y: number, now: Ms) {
  const obj = objectAt(state, x, y);
  return { obj, status: objectStatus(state, obj, now) };
}

/** How many things are waiting to be collected (for the welcome-back message). */
export function readyCount(state: FarmState, now: Ms): number {
  let count = 0;
  for (const obj of Object.values(state.objects)) {
    const status = objectStatus(state, obj, now);
    if (status.kind === "ripe") count++;
    else if (status.kind === "producer" && status.ready) count++;
    else if (status.kind === "building") count += status.readyCount;
  }
  return count;
}

export function shedSummary(state: FarmState) {
  return { used: inventoryUsed(state), capacity: inventoryCapacity(state) };
}
