import type { ConsumableDef } from "./types";

export const SPECIALS = [
  {
    kind: "consumable",
    id: "unwither_tonic",
    name: "Unwither Tonic",
    icon: "💧",
    unlockLevel: 1,
    price: { clovers: 2 },
    effect: { type: "unwither" },
  },
  {
    kind: "consumable",
    id: "coin_pouch",
    name: "Pouch of Coins",
    icon: "💰",
    unlockLevel: 1,
    price: { clovers: 1 },
    effect: { type: "coins", amount: 1000 },
  },
  {
    kind: "consumable",
    id: "fuel_can",
    name: "Fuel Can",
    icon: "⛽",
    unlockLevel: 12,
    price: { coins: 250 },
    effect: { type: "fuel", units: 25 },
  },
  {
    kind: "consumable",
    id: "fertilizer_pack",
    name: "Fertilizer Sack",
    icon: "🌿",
    unlockLevel: 3,
    price: { coins: 150 },
    effect: { type: "material", id: "fertilizer_sack", amount: 1 },
  },
] as const satisfies readonly ConsumableDef[];

export type ConsumableId = (typeof SPECIALS)[number]["id"];
