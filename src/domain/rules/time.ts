import { MANURE } from "../catalog/balance";
import { getCrop } from "../catalog/registry";
import { WITHER } from "../constants";
import { hash32, toUnit } from "../rng/hash";
import type { Ms, ObjectId } from "../types/ids";
import type { CropState } from "../types/state";

export interface CropTimeline {
  growMs: Ms;
  plantedAt: Ms;
  ripeAt: Ms;
  /** Guaranteed ripe until this moment. */
  safeUntil: Ms;
  /** The seeded moment inside the cushion when this plot withers (Infinity if protected). */
  witherAt: Ms;
}

export function cropTimeline(plotId: ObjectId, crop: CropState, salt: number): CropTimeline {
  const def = getCrop(crop.cropId);
  if (!def) throw new Error(`Unknown crop ${crop.cropId}`);
  const base = crop.plantedAt + def.growMs;
  // Manure skips part of the time that was left when it landed.
  const manured = crop.manure && crop.manure.at < base ? crop.manure.at : null;
  const grown = manured === null ? base : Math.round(base - MANURE.growCut * (base - manured));
  const ripeAt = crop.revivedAt ?? grown;
  /** Visual growth runs over the (possibly shortened) time to ripeness. */
  const growMs = Math.max(1, grown - crop.plantedAt);
  if (crop.witherProof) {
    return { growMs, plantedAt: crop.plantedAt, ripeAt, safeUntil: Infinity, witherAt: Infinity };
  }
  const safe = Math.max(def.growMs * WITHER.safeMult, WITHER.minSafe);
  const cushion = Math.max(def.growMs * WITHER.cushionMult, WITHER.minCushion);
  const u = toUnit(hash32("wither", salt, plotId, crop.plantedAt, crop.revivedAt ?? 0));
  return {
    growMs,
    plantedAt: crop.plantedAt,
    ripeAt,
    safeUntil: ripeAt + safe,
    witherAt: ripeAt + safe + Math.floor(u * cushion),
  };
}

export type GrowthVisual = 0 | 1 | 2 | 3;

export type CropStage =
  | { stage: "growing"; progress: number; visual: GrowthVisual; ripeAt: Ms }
  | { stage: "ripe"; safeUntil: Ms; witherAt: Ms }
  | { stage: "withered"; witherAt: Ms };

export function stageFromTimeline(timeline: CropTimeline, now: Ms): CropStage {
  if (now < timeline.ripeAt) {
    const progress = Math.max(0, (now - timeline.plantedAt) / timeline.growMs);
    const visual = Math.min(3, Math.floor(progress * 4)) as GrowthVisual;
    return { stage: "growing", progress, visual, ripeAt: timeline.ripeAt };
  }
  if (now < timeline.witherAt) {
    return { stage: "ripe", safeUntil: timeline.safeUntil, witherAt: timeline.witherAt };
  }
  return { stage: "withered", witherAt: timeline.witherAt };
}

export function cropStage(plotId: ObjectId, crop: CropState, salt: number, now: Ms): CropStage {
  return stageFromTimeline(cropTimeline(plotId, crop, salt), now);
}

/** Next moment this crop's look changes (growth step, ripening or withering). */
export function nextCropChange(timeline: CropTimeline, now: Ms): Ms {
  if (now < timeline.ripeAt) {
    const quarter = timeline.growMs / 4;
    const step = Math.floor((now - timeline.plantedAt) / quarter) + 1;
    return Math.min(timeline.ripeAt, timeline.plantedAt + step * quarter);
  }
  return now < timeline.witherAt ? timeline.witherAt : Infinity;
}

export interface ProducerStatus {
  ready: boolean;
  readyAt: Ms;
  progress: number;
}

export function producerStatus(cycleStart: Ms, cycleMs: Ms, now: Ms): ProducerStatus {
  const readyAt = cycleStart + cycleMs;
  return {
    ready: now >= readyAt,
    readyAt,
    progress: Math.min(1, Math.max(0, (now - cycleStart) / cycleMs)),
  };
}
