import { CLOVER_SELL_COINS, SELL_RATE } from "../constants";
import { ANIMALS } from "./animals";
import { BUILDINGS } from "./buildings";
import { CROPS, type CropId } from "./crops";
import { DECORATIONS } from "./decorations";
import { EVENT_ANIMALS, EVENT_CROPS, EVENT_DECORATIONS } from "./events";
import { EXPANSIONS } from "./expansions";
import { FEATURE_LEVEL } from "./levels";
import { MATERIALS } from "./materials";
import { SPECIALS } from "./specials";
import { TREES } from "./trees";
import type {
  AnyDef,
  BuildingDef,
  ConsumableDef,
  CropDef,
  FeatureId,
  MarketTab,
  MaterialDef,
  PlaceableDef,
  ProducerDef,
  VehicleDef,
} from "./types";
import { VEHICLES } from "./vehicles";

export const ALL_DEFS: readonly AnyDef[] = [
  ...CROPS,
  ...EVENT_CROPS,
  ...ANIMALS,
  ...EVENT_ANIMALS,
  ...TREES,
  ...BUILDINGS,
  ...DECORATIONS,
  ...EVENT_DECORATIONS,
  ...SPECIALS,
  ...VEHICLES,
  ...MATERIALS,
];

const BY_ID = new Map<string, AnyDef>(ALL_DEFS.map((def) => [def.id, def]));

export const getDef = (id: string): AnyDef | undefined => BY_ID.get(id);

export function getCrop(id: string): CropDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === "crop" ? def : undefined;
}

export function getPlaceable(id: string): PlaceableDef | undefined {
  const def = BY_ID.get(id);
  return def &&
    (def.kind === "animal" ||
      def.kind === "tree" ||
      def.kind === "building" ||
      def.kind === "decoration" ||
      def.kind === "vehicle")
    ? def
    : undefined;
}

export function getProducer(id: string): ProducerDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === "animal" || def?.kind === "tree" ? def : undefined;
}

export function getBuilding(id: string): BuildingDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === "building" ? def : undefined;
}

export function getMaterial(id: string): MaterialDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === "material" ? def : undefined;
}

export function getVehicle(id: string): VehicleDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === "vehicle" ? def : undefined;
}

export function getConsumable(id: string): ConsumableDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === "consumable" ? def : undefined;
}

export const isCropId = (id: string): id is CropId => getCrop(id) !== undefined;

export function marketTabOf(def: AnyDef): MarketTab | null {
  // Event content lives in the event shop (and the seed picker while the event runs).
  if (def.event) return null;
  switch (def.kind) {
    case "crop":
      return "seeds";
    case "animal":
      return "animals";
    case "tree":
      return "trees";
    case "building":
      return def.price ? "buildings" : null;
    case "decoration":
      return def.rewardOnly ? null : "decorations";
    case "consumable":
      return "specials";
    case "vehicle":
      return "vehicles";
    case "material":
      return null;
  }
}

/** Level at which a market tab opens. */
export function tabUnlockLevel(tab: MarketTab): number {
  if (tab === "animals") return FEATURE_LEVEL.animals;
  if (tab === "trees") return FEATURE_LEVEL.trees;
  if (tab === "buildings") return FEATURE_LEVEL.buildings;
  if (tab === "vehicles") return FEATURE_LEVEL.vehicles;
  return 1;
}

export function defsByTab(tab: MarketTab): AnyDef[] {
  return ALL_DEFS.filter((def) => marketTabOf(def) === tab).sort(
    (a, b) => a.unlockLevel - b.unlockLevel,
  );
}

/** Coins refunded when a placed item is sold. */
export function sellValue(def: PlaceableDef): number {
  if (!def.price) return 0;
  if ("clovers" in def.price) return def.price.clovers * CLOVER_SELL_COINS;
  const rate =
    def.kind === "animal" || def.kind === "tree"
      ? SELL_RATE.producer
      : def.kind === "building"
        ? SELL_RATE.building
        : SELL_RATE.decoration;
  return Math.floor(def.price.coins * rate);
}

export type UnlockRef =
  | { readonly kind: "item"; readonly defId: string }
  | { readonly kind: "feature"; readonly feature: FeatureId }
  | { readonly kind: "expansion"; readonly size: number }
  | { readonly kind: "upgrade"; readonly defId: string; readonly tier: 2 | 3 };

/** Everything that becomes available on reaching `level`. */
export function unlocksAt(level: number): UnlockRef[] {
  const unlocks: UnlockRef[] = [];
  for (const def of ALL_DEFS) {
    if (def.unlockLevel === level && marketTabOf(def) !== null) {
      unlocks.push({ kind: "item", defId: def.id });
    }
  }
  for (const [feature, featureLevel] of Object.entries(FEATURE_LEVEL)) {
    if (featureLevel === level) unlocks.push({ kind: "feature", feature: feature as FeatureId });
  }
  for (const expansion of EXPANSIONS) {
    if (expansion.index > 0 && expansion.level === level) {
      unlocks.push({ kind: "expansion", size: expansion.size });
    }
  }
  for (const building of BUILDINGS) {
    building.upgrades.forEach((upgrade, i) => {
      if (upgrade.level === level) {
        unlocks.push({ kind: "upgrade", defId: building.id, tier: i === 0 ? 2 : 3 });
      }
    });
  }
  return unlocks;
}
