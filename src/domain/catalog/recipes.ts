import { HOUR, MINUTE } from "../constants";
import { craftXp, goodSale, SILK_SALE } from "./balance";
import { CROPS } from "./crops";
import type { MaterialDef, Station } from "./types";

const round5 = (n: number) => Math.round(n / 5) * 5;

export type { Station };

export interface RecipeDef {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly station: Station;
  readonly unlockLevel: number;
  readonly timeMs: number;
  /** Material id → count, taken when the job starts. */
  readonly inputs: Readonly<Record<string, number>>;
  /** Fuel gained when the good is used (fuel goods only). */
  readonly fuel?: number;
}

export const RECIPES: readonly RecipeDef[] = [
  {
    id: "wheat_flour",
    name: "Wheat Flour",
    icon: "🥣",
    station: "mill",
    unlockLevel: 15,
    timeMs: 2 * HOUR,
    inputs: { bushel_goldenstalk_wheat: 2 },
  },
  {
    id: "cornmeal",
    name: "Cornmeal",
    icon: "🌽",
    station: "mill",
    unlockLevel: 15,
    timeMs: 90 * MINUTE,
    inputs: { bushel_sweetcob_corn: 2 },
  },
  {
    id: "sunseed_oil",
    name: "Sunseed Oil",
    icon: "🛢️",
    station: "mill",
    unlockLevel: 15,
    timeMs: 3 * HOUR,
    inputs: { bushel_sunflower_crown: 2 },
    fuel: 15,
  },
  {
    id: "berry_tart",
    name: "Berry Tart",
    icon: "🥧",
    station: "bakery",
    unlockLevel: 16,
    timeMs: 30 * MINUTE,
    inputs: { bushel_sunpop_berry: 2, bushel_bluebell_berry: 1 },
  },
  {
    id: "carrot_loaf",
    name: "Carrot Loaf",
    icon: "🍞",
    station: "bakery",
    unlockLevel: 16,
    timeMs: 2 * HOUR,
    inputs: { wheat_flour: 1, bushel_button_carrot: 2 },
  },
  {
    id: "pumpkin_pie",
    name: "Pumpkin Pie",
    icon: "🥮",
    station: "bakery",
    unlockLevel: 18,
    timeMs: 4 * HOUR,
    inputs: { wheat_flour: 1, bushel_patchwork_pumpkin: 1 },
  },
  {
    id: "pepper_relish",
    name: "Pepper Relish",
    icon: "🫙",
    station: "press",
    unlockLevel: 19,
    timeMs: 1 * HOUR,
    inputs: { bushel_fire_pepper: 2, bushel_ruby_tomato: 1 },
  },
  {
    id: "silk_ribbon",
    name: "Silk Ribbon",
    icon: "🎀",
    station: "press",
    unlockLevel: 20,
    timeMs: 2 * HOUR,
    inputs: { silk: 2 },
  },
  {
    id: "lavender_oil",
    name: "Lavender Oil",
    icon: "🧴",
    station: "press",
    unlockLevel: 21,
    timeMs: 3 * HOUR,
    inputs: { bushel_lavender_plume: 3 },
  },
  {
    id: "grape_cordial",
    name: "Grape Cordial",
    icon: "🍷",
    station: "press",
    unlockLevel: 24,
    timeMs: 6 * HOUR,
    inputs: { bushel_twilight_grape: 3 },
  },
  {
    id: "tulip_perfume",
    name: "Tulip Perfume",
    icon: "💐",
    station: "press",
    unlockLevel: 36,
    timeMs: 8 * HOUR,
    inputs: { bushel_rainbow_tulip: 2, bushel_ember_rose: 1 },
  },
];

/** A bushel is worth 40% of its crop's sale. */
const bushelValue = (id: string) => {
  const crop = CROPS.find((c) => `bushel_${c.id}` === id);
  return crop ? round5(0.4 * crop.sale) : 0;
};

/** Raw materials that aren't bushels. */
const RAW_VALUE: Readonly<Record<string, number>> = { silk: SILK_SALE };

/** Sale value of any recipe input; crafted goods count at their own sale. */
function inputValue(id: string, goods: Map<string, number>): number {
  return goods.get(id) ?? RAW_VALUE[id] ?? bushelValue(id);
}

/** Goods made by recipes. Sale = 1.3 × inputs, XP = inputs / 40 (see balance.ts). */
function buildGoods(): { goods: MaterialDef[]; xp: Map<string, number> } {
  const sales = new Map<string, number>();
  const xp = new Map<string, number>();
  const goods: MaterialDef[] = [];
  for (const recipe of RECIPES) {
    const value = Object.entries(recipe.inputs).reduce(
      (sum, [id, n]) => sum + inputValue(id, sales) * n,
      0,
    );
    const sale = goodSale(value);
    sales.set(recipe.id, sale);
    xp.set(recipe.id, craftXp(value));
    goods.push({
      kind: "material",
      mkind: "good",
      id: recipe.id,
      name: recipe.name,
      icon: recipe.icon,
      unlockLevel: recipe.unlockLevel,
      cap: 99,
      sale,
      ...(recipe.fuel ? { fuel: recipe.fuel } : {}),
    });
  }
  return { goods, xp };
}

const built = buildGoods();
export const GOODS: readonly MaterialDef[] = built.goods;

export const recipeXp = (id: string) => built.xp.get(id) ?? 0;
export const getRecipe = (id: string) => RECIPES.find((r) => r.id === id);
export const recipesFor = (station: Station) => RECIPES.filter((r) => r.station === station);
