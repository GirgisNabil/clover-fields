import type { ObjectId, Rotation } from "./ids";

/** Commands the farmer walks over and performs. They target tiles, not ids. */
export type FieldCommand =
  | { type: "plow"; x: number; y: number }
  | { type: "plant"; x: number; y: number; cropId: string }
  | { type: "harvest"; x: number; y: number; expect?: ObjectId }
  /** A vehicle pass over the square area whose top-left tile is (x, y). */
  | { type: "drive"; vehicleId: ObjectId; x: number; y: number; cropId?: string }
  /** Collect a roaming animal's product; (x, y) is where the farmer walks (the animal's spot). */
  | { type: "collectAnimal"; id: ObjectId; x: number; y: number };

/** Commands that apply immediately. */
export type InstantCommand =
  | { type: "buyPlace"; defId: string; x: number; y: number; rot: Rotation }
  | { type: "buyItem"; defId: string; qty: number }
  | { type: "move"; id: ObjectId; x: number; y: number; rot: Rotation }
  | { type: "sell"; id: ObjectId }
  | { type: "store"; id: ObjectId }
  | { type: "placeStored"; defId: string; x: number; y: number; rot: Rotation }
  | { type: "house"; id: ObjectId; buildingId: ObjectId }
  | {
      type: "release";
      buildingId: ObjectId;
      occupantId: ObjectId;
      x: number;
      y: number;
      rot: Rotation;
    }
  | { type: "upgrade"; id: ObjectId }
  | { type: "expand"; pay: "coins" | "clovers" }
  | { type: "useItem"; defId: string }
  | { type: "craft"; buildingId: ObjectId; recipeId: string }
  | { type: "sellMaterial"; id: string; qty: number }
  | { type: "useMaterial"; id: string }
  /** No effect of its own: lets time-based settling (roaming animals) run while nobody acts. */
  | { type: "settle" }
  | { type: "redeemSet"; setId: string }
  | { type: "claimQuest"; lineId: string }
  | { type: "claimDaily" }
  | { type: "buyEventItem"; eventId: string; defId: string }
  | { type: "helpNeighbor"; npcId: string; x: number; y: number }
  | { type: "claimGift"; npcId: string }
  | { type: "giftNeighbor"; npcId: string; id: string }
  | { type: "fertilize"; x: number; y: number }
  | { type: "swapCollectible"; want: string }
  | { type: "dev"; op: DevOp };

export type DevOp =
  | {
      kind: "grant";
      coins?: number;
      clovers?: number;
      xp?: number;
      materials?: Record<string, number>;
    }
  | { kind: "rebaseTime"; deltaMs: number };

export type Command = FieldCommand | InstantCommand;

export const isFieldCommand = (cmd: Command): cmd is FieldCommand =>
  cmd.type === "plow" ||
  cmd.type === "plant" ||
  cmd.type === "harvest" ||
  cmd.type === "drive" ||
  cmd.type === "collectAnimal";
