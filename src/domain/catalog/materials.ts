import { SILK_SALE } from "./balance";
import { COLLECTIBLES } from "./collections";
import { CROPS } from "./crops";
import { GOODS } from "./recipes";
import type { MaterialDef } from "./types";

const round5 = (n: number) => Math.round(n / 5) * 5;

/** One bushel per crop, worth 40% of the crop's sale. Drops randomly on harvest (from level 15). */
export const BUSHELS: readonly MaterialDef[] = CROPS.map((crop) => ({
  kind: "material",
  mkind: "bushel",
  id: `bushel_${crop.id}`,
  name: `${crop.name} Bushel`,
  icon: crop.icon,
  unlockLevel: 1,
  cap: 20,
  sale: round5(0.4 * crop.sale),
}));

export const SUPPLIES: readonly MaterialDef[] = [
  {
    kind: "material",
    mkind: "supply",
    id: "brass_cog",
    name: "Brass Cog",
    icon: "⚙️",
    unlockLevel: 1,
    cap: 99,
  },
  {
    kind: "material",
    mkind: "supply",
    id: "fertilizer_sack",
    name: "Fertilizer Sack",
    icon: "🌿",
    unlockLevel: 1,
    cap: 99,
  },
];

/** Raw animal products that are materials rather than coins. */
export const RAW_GOODS: readonly MaterialDef[] = [
  {
    kind: "material",
    mkind: "good",
    id: "silk",
    name: "Silk",
    icon: "🧵",
    unlockLevel: 17,
    cap: 99,
    sale: SILK_SALE,
  },
];

export const MATERIALS: readonly MaterialDef[] = [
  ...BUSHELS,
  ...SUPPLIES,
  ...RAW_GOODS,
  ...GOODS,
  ...COLLECTIBLES,
];
