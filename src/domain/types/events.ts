import type { UnlockRef } from "../catalog/registry";
import type { Ms, ObjectId, Rotation, Tile } from "./ids";

export type Reason =
  | "plow"
  | "seed"
  | "harvest"
  | "mastery"
  | "levelUp"
  | "buy"
  | "sell"
  | "upgrade"
  | "expand"
  | "item"
  | "quest"
  | "ribbon"
  | "daily"
  | "neighbor"
  | "event"
  | "craft"
  | "collection"
  | "vehicle"
  | "dev";

/** Domain events describe what a command did, so the UI can animate, play sounds and celebrate. */
export type DomainEvent =
  | { t: "coins"; delta: number; reason: Reason; at?: Tile }
  | { t: "clovers"; delta: number; reason: Reason; at?: Tile }
  | { t: "xp"; amount: number; reason: Reason; at?: Tile }
  | {
      t: "levelUp";
      level: number;
      title: string;
      coins: number;
      clovers: number;
      unlocks: UnlockRef[];
    }
  | { t: "plowed"; at: Tile; plotId: ObjectId; clearedWithered: boolean }
  | { t: "planted"; at: Tile; plotId: ObjectId; cropId: string }
  | {
      t: "harvested";
      at: Tile;
      objectId: ObjectId;
      defId: string;
      coins: number;
      xp: number;
      count: number;
    }
  | {
      t: "masteryStar";
      cropId: string;
      star: 1 | 2 | 3;
      coins: number;
      xp: number;
      signGranted: boolean;
    }
  | {
      t: "placed";
      objectId: ObjectId;
      defId: string;
      at: Tile;
      rot: Rotation;
      source: "market" | "storage" | "building";
    }
  | { t: "moved"; objectId: ObjectId; from: Tile; to: Tile; rot: Rotation }
  | {
      t: "removed";
      objectId: ObjectId;
      defId: string;
      to: "sold" | "storage" | "building";
      refund: number;
      at: Tile;
    }
  | { t: "inventory"; defId: string; delta: number }
  | { t: "upgraded"; objectId: ObjectId; tier: 2 | 3; capacity: number }
  | { t: "landExpanded"; size: number }
  | { t: "revived"; plotIds: ObjectId[] }
  | { t: "timeRebased"; deltaMs: Ms }
  | { t: "material"; id: string; delta: number; capped: boolean; at?: Tile }
  | { t: "fuel"; units: number; delta: number; reason: Reason }
  | { t: "vehiclePass"; vehicleId: ObjectId; op: string; tiles: Tile[] }
  | { t: "eventTokens"; eventId: string; delta: number; total: number }
  | { t: "eventSettled"; eventId: string; tokens: number; coins: number }
  | { t: "dailyClaimed"; day: number; streak: number }
  | { t: "dailyTask"; id: string }
  | { t: "dailyBonus" }
  | { t: "neighborHelped"; npcId: string; x: number; y: number; friendship: number }
  | { t: "giftReceived"; npcId: string }
  | { t: "giftGiven"; npcId: string; id: string }
  | { t: "questStarted"; lineId: string; npc: string }
  | { t: "questStep"; lineId: string; npc: string; step: number; last: boolean }
  | { t: "found"; id: string; setId: string; at?: Tile }
  | { t: "setRedeemed"; setId: string; times: number }
  | { t: "ribbon"; id: string; tier: number }
  | { t: "manured"; plotId: ObjectId; at: Tile; by: string }
  | { t: "craftStarted"; buildingId: ObjectId; recipeId: string; readyAt: Ms }
  | { t: "crafted"; buildingId: ObjectId; outputs: Record<string, number>; at: Tile };

export type Emit = (event: DomainEvent) => void;
