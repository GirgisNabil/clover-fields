import type { AnimalId } from "../catalog/animals";
import type { BuildingId } from "../catalog/buildings";
import type { CropId } from "../catalog/crops";
import type { TreeId } from "../catalog/trees";
import type { VehicleId } from "../catalog/vehicles";
import type { Ms, ObjectId, Rotation } from "./ids";

export interface FarmState {
  v: 3;
  meta: {
    farmId: string;
    createdAt: Ms;
    /** Latest time any command ran at; time never runs backwards past it. */
    lastNow: Ms;
    nextId: number;
    /** Public salt for hash-derived visible randomness (wither moments). */
    witherSalt: number;
    /** Minutes added to UTC to find the player's local day (set once, at creation). */
    dayOffsetMin: number;
  };
  /** Hidden-outcome randomness; the seed becomes server-only later. */
  rng: { seed: number; counter: number };
  land: { size: number; expansionIndex: number };
  wallet: { coins: number; clovers: number };
  /** `xp` is cumulative; `level` is cached from it. */
  progress: { xp: number; level: number };
  objects: Record<ObjectId, FarmObject>;
  inventory: { items: Record<string, number> };
  mastery: Partial<Record<CropId, MasteryState>>;
  stats: { counters: Record<string, number> };
  /** Vehicle fuel; regenerates lazily from `anchor` (see rules/fuel.ts). */
  fuel: { units: number; anchor: Ms };
  /** Bushels, goods, supplies and collectibles (not placeable, no shed slot). */
  materials: Record<string, number>;
  collections: Record<string, { redeemed: number }>;
  /** Highest tier reached per ribbon (1–4). */
  ribbons: Record<string, number>;
  quests: {
    active: Record<string, QuestProgress>;
    done: Record<string, Ms>;
  };
  daily: DailyState;
  neighbors: Record<string, NeighborState>;
  events: Record<string, { edition: number; tokens: number; settled: boolean }>;
  /** Roaming animals: visit windows up to `settledAt` have been applied (see rules/animals.ts). */
  animals: { settledAt: Ms };
}

export interface QuestProgress {
  step: number;
  startedAt: Ms;
  /** Stat values when the step started; `count` goals measure progress from here. */
  base: Record<string, number>;
}

export interface DailyState {
  lastClaimAt: Ms | null;
  streak: number;
  best: number;
  /** When today's tasks were picked (a stale day means no tasks yet). */
  taskAt: Ms | null;
  tasks: Array<{ id: string; base: number; done: boolean }>;
}

export interface NeighborState {
  /** Time of the last help; `helped` only counts if that was today. */
  helpAt: Ms | null;
  helped: string[];
  giftAt: Ms | null;
  giftedAt: Ms | null;
  friendship: number;
}

export interface CraftJob {
  recipeId: string;
  startedAt: Ms;
  readyAt: Ms;
}

export interface MasteryState {
  count: number;
  stars: 0 | 1 | 2 | 3;
}

interface Base<K extends string, D extends string> {
  kind: K;
  id: ObjectId;
  defId: D;
  /** Anchor tile: the footprint corner with the smallest x and y. */
  x: number;
  y: number;
  rot: Rotation;
  placedAt: Ms;
}

export interface CropState {
  cropId: CropId;
  plantedAt: Ms;
  /** Set by an Unwither Tonic: the crop counts as freshly ripe from this moment. */
  revivedAt: Ms | null;
  /** Planted by a beginner, so it never withers. */
  witherProof: boolean;
  /** Fertilized crops count double toward mastery and drop bushels more often. */
  fertilized: boolean;
  /** Manure from a roaming animal (or a Fertilizer Sack): ripens sooner, pays more. Never stacks. */
  manure: { at: Ms; by: string } | null;
}

export type PlotObject = Base<"plot", "plot"> & {
  soil: "fallow" | "plowed" | "planted";
  crop: CropState | null;
};

export type AnimalObject = Base<"animal", AnimalId> & { cycleStart: Ms };
export type TreeObject = Base<"tree", TreeId> & { cycleStart: Ms };

export interface Occupant {
  id: ObjectId;
  defId: AnimalId | TreeId;
  cycleStart: Ms;
}

export type BuildingObject = Base<"building", BuildingId> & {
  tier: 1 | 2 | 3;
  occupants: Occupant[];
  /** Crafting jobs (craft buildings only). */
  jobs: CraftJob[];
};

export type DecorationObject = Base<"decoration", string>;

export type VehicleObject = Base<"vehicle", VehicleId> & { tier: 1 | 2 };

export type FarmObject =
  | PlotObject
  | AnimalObject
  | TreeObject
  | BuildingObject
  | DecorationObject
  | VehicleObject;

export type ProducerObject = AnimalObject | TreeObject;
