import { create } from "zustand";
import type { MarketTab, ObjectId, Rotation, Tile } from "@/domain";

export type Tool = "hand" | "plow" | "seed" | "arrange" | "place" | "sell" | "drive" | "fertilize";

export type Dialog =
  | null
  | "seeds"
  | "market"
  | "storage"
  | "building"
  | "settings"
  | "book"
  | "quest"
  | "daily"
  | "neighbors"
  | "event";
export type BookTab = "collections" | "ribbons" | "stats";

/** What the placement ghost is carrying. */
export interface Placing {
  defId: string;
  rot: Rotation;
  source:
    | "market"
    | "storage"
    | { move: ObjectId }
    | { release: { buildingId: ObjectId; occupantId: ObjectId } };
}

export interface UiStore {
  tool: Tool;
  /** Last seed chosen; the seed tool and multi-tool plant this. */
  seedId: string;
  hover: Tile | null;
  /** The roaming animal under the mouse, if any (animals don't sit on tiles). */
  hoverAnimal: string | null;
  /** Keyboard play: the tile the arrow keys move (null until the farm is focused). */
  cursor: Tile | null;
  /** Spoken by screen readers (aria-live). */
  announce: string;
  bookTab: BookTab;
  /** The neighbour whose quest card is open. */
  questNpc: string | null;
  pointer: { x: number; y: number; inside: boolean };
  dialog: Dialog;
  marketTab: MarketTab;
  placing: Placing | null;
  /** Building whose details dialog is open. */
  buildingId: ObjectId | null;
  /** Vehicle the Vehicles tool drives. */
  vehicleId: ObjectId | null;
  setTool(tool: Tool): void;
  chooseSeed(seedId: string): void;
  openDialog(dialog: Dialog): void;
  openMarket(tab?: MarketTab): void;
  startPlacing(placing: Placing): void;
  rotatePlacing(): void;
  stopPlacing(): void;
  openBuilding(id: ObjectId): void;
}

export const useUi = create<UiStore>()((set, get) => ({
  tool: "hand",
  seedId: "clover_sprout",
  hover: null,
  hoverAnimal: null,
  cursor: null,
  announce: "",
  bookTab: "collections",
  questNpc: null,
  pointer: { x: 0, y: 0, inside: false },
  dialog: null,
  marketTab: "seeds",
  placing: null,
  buildingId: null,
  vehicleId: null,
  setTool: (tool) => set({ tool, placing: tool === "place" ? get().placing : null }),
  chooseSeed: (seedId) => set({ seedId, tool: "seed", dialog: null, placing: null }),
  openDialog: (dialog) => set({ dialog }),
  openMarket: (tab) => set({ dialog: "market", ...(tab ? { marketTab: tab } : {}) }),
  startPlacing: (placing) => set({ placing, tool: "place", dialog: null }),
  rotatePlacing: () => {
    const placing = get().placing;
    if (placing) set({ placing: { ...placing, rot: ((placing.rot + 1) % 4) as Rotation } });
  },
  stopPlacing: () => set({ placing: null, tool: get().tool === "place" ? "hand" : get().tool }),
  openBuilding: (id) => set({ dialog: "building", buildingId: id }),
}));
