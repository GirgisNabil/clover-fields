import type { Ms } from "../types/ids";
/** Which crafting building a recipe runs in. */
export type Station = "mill" | "bakery" | "press";

export type Price = { readonly coins: number } | { readonly clovers: number };

export type MarketTab =
  | "seeds"
  | "trees"
  | "animals"
  | "buildings"
  | "decorations"
  | "specials"
  | "vehicles"
  | "expansions";

export type HousingCategory = "poultry" | "barnyard" | "stable" | "orchard" | "moth";

/** Game features that unlock by level (items unlock through their own `unlockLevel`). */
export type FeatureId =
  | "animals"
  | "trees"
  | "store"
  | "sell"
  | "buildings"
  | "quests"
  | "ribbons"
  | "daily"
  | "neighbors"
  | "events"
  | "collections"
  | "vehicles"
  | "crafting"
  | "garage";

/** Procedural look of a crop; the renderer builds geometry from it. */
export type CropShape =
  | "sprig"
  | "bush"
  | "root"
  | "grain"
  | "stalk"
  | "tallflower"
  | "vine"
  | "pod"
  | "leafy"
  | "spiky"
  | "flower";

export interface CropLook {
  readonly shape: CropShape;
  /** Foliage color. */
  readonly color: string;
  /** Produce color (fruit, flower, grain head). */
  readonly accent: string;
}

interface DefBase {
  readonly id: string;
  readonly name: string;
  /** Emoji used in menus and as a last-resort visual. */
  readonly icon: string;
  readonly unlockLevel: number;
  /** Seasonal-event content: planted only during the event, bought with its tokens. */
  readonly event?: string;
}

export interface CropDef extends DefBase {
  readonly kind: "crop";
  readonly growMs: Ms;
  readonly seedCost: number;
  readonly sale: number;
  readonly plantXp: number;
  /** Cumulative harvests needed for mastery stars 1, 2 and 3. */
  readonly mastery: readonly [number, number, number];
  readonly look: CropLook;
}

interface PlaceableBase extends DefBase {
  /** Width (x) and depth (y) in tiles at rotation 0. */
  readonly footprint: readonly [number, number];
  readonly price: Price | null;
  readonly xpOnBuy: number;
  readonly sellable: boolean;
  readonly storable: boolean;
  readonly walkable: boolean;
}

export interface ProducerDef extends PlaceableBase {
  readonly kind: "animal" | "tree";
  readonly cycleMs: Ms;
  readonly payout: number;
  readonly product: { readonly name: string; readonly icon: string };
  /** A material dropped on every collect, on top of the coins (silk moths give silk). */
  readonly material?: string;
  readonly housing: HousingCategory;
}

export interface Upgrade {
  readonly price: Price;
  readonly level: number;
}

export interface BuildingDef extends PlaceableBase {
  readonly kind: "building";
  readonly role:
    | { readonly type: "housing"; readonly accepts: HousingCategory }
    | { readonly type: "storage" }
    /** Holds vehicles and raises the fuel tank cap (capacity = cap per tier). */
    | { readonly type: "garage"; readonly fuelCap: readonly [number, number, number] }
    /** Runs crafting recipes for its station; capacity = parallel job slots. */
    | { readonly type: "craft"; readonly station: Station };
  readonly capacity: readonly [number, number, number];
  readonly upgrades: readonly [Upgrade, Upgrade];
}

export interface DecorationDef extends PlaceableBase {
  readonly kind: "decoration";
  /** Only obtainable as a reward, never sold in the market. */
  readonly rewardOnly?: true;
  /** For mastery signs: the crop this sign celebrates. */
  readonly masteryOf?: string;
}

export type ConsumableEffect =
  | { readonly type: "unwither" }
  | { readonly type: "coins"; readonly amount: number }
  | { readonly type: "fuel"; readonly units: number }
  /** Adds a material (bought supplies such as Fertilizer Sacks). */
  | { readonly type: "material"; readonly id: string; readonly amount: number };

export interface ConsumableDef extends DefBase {
  readonly kind: "consumable";
  readonly price: Price;
  readonly effect: ConsumableEffect;
}

export interface ExpansionDef {
  readonly index: number;
  readonly size: number;
  readonly level: number;
  /** Reserved for the social build; always 0 for now. */
  readonly neighbors: number;
  readonly price: Price;
  /** Alternative price in Golden Clovers. */
  readonly alt: Price;
}

export type VehicleOp = "plow" | "plant" | "harvest" | "combine";

export interface VehicleUpgrade extends Upgrade {
  readonly materials: Readonly<Record<string, number>>;
}

/** Works a square area in one pass (one farmer-queue job), using fuel per tile worked. */
export interface VehicleDef extends PlaceableBase {
  readonly kind: "vehicle";
  readonly op: VehicleOp;
  readonly fuelPerTile: number;
  /** Side of the square area at tier 1 and tier 2. */
  readonly area: readonly [number, number];
  readonly upgrade: VehicleUpgrade;
}

export type PlaceableDef = ProducerDef | BuildingDef | DecorationDef | VehicleDef;
export type MaterialKind = "bushel" | "good" | "supply" | "collectible";
export type Rarity = "common" | "uncommon" | "rare" | "veryRare";

/** Things you hold but never place: bushels, crafted goods, supplies and collectibles. */
export interface MaterialDef extends DefBase {
  readonly kind: "material";
  readonly mkind: MaterialKind;
  /** Most you can hold; extra drops are lost. */
  readonly cap: number;
  /** Coins when sold (0 or absent: can't be sold). */
  readonly sale?: number;
  /** Fuel gained when used. */
  readonly fuel?: number;
  readonly setId?: string;
  readonly rarity?: Rarity;
}

export type AnyDef = CropDef | PlaceableDef | ConsumableDef | MaterialDef;

export function priceCoins(price: Price | null): number {
  return price && "coins" in price ? price.coins : 0;
}

export function priceClovers(price: Price | null): number {
  return price && "clovers" in price ? price.clovers : 0;
}
