import { toast } from "sonner";
import {
  describeError,
  type FarmObject,
  footprint,
  getBuilding,
  getDef,
  getPlaceable,
  getProducer,
  getVehicle,
  type ObjectId,
  objectAt,
  producerStatus,
  projectedState,
  type Rotation,
  sellValue,
  type Tile,
} from "@/domain";
import { animalSpots } from "../animals/spots";
import { clock } from "../clock";
import { useGame } from "../store/gameStore";
import { type Placing, useUi } from "../store/uiStore";
import { formatDuration } from "./describe";

/** Footprint origin for an item held under the pointer: the item is centered on the hovered tile. */
export function placementAnchor(hover: Tile, defId: string, rot: Rotation): Tile {
  const { w, h } = footprint(defId, rot);
  return { x: hover.x - Math.floor((w - 1) / 2), y: hover.y - Math.floor((h - 1) / 2) };
}

/** A housing building under the pointer that would take the producer being moved. */
export function housingTarget(placing: Placing, tile: Tile) {
  if (typeof placing.source !== "object" || !("move" in placing.source)) return null;
  const producer = getProducer(placing.defId);
  if (!producer) return null;
  const farm = useGame.getState().farm;
  const obj = objectAt(farm, tile.x, tile.y);
  if (obj?.kind !== "building") return null;
  const def = getBuilding(obj.defId);
  return def?.role.type === "housing" && def.role.accepts === producer.housing ? obj : null;
}

/** Drops the held item at the hovered tile. */
export function placeAt(hover: Tile) {
  const ui = useUi.getState();
  const placing = ui.placing;
  if (!placing) return;
  const { x, y } = placementAnchor(hover, placing.defId, placing.rot);
  const game = useGame.getState();
  const source = placing.source;
  let error = null;
  if (source === "market") {
    error = game.dispatch({ type: "buyPlace", defId: placing.defId, x, y, rot: placing.rot });
    // Decorations stay on the cursor so you can place a row of fences in one go.
    if (!error && getPlaceable(placing.defId)?.kind !== "decoration") ui.stopPlacing();
  } else if (source === "storage") {
    error = game.dispatch({ type: "placeStored", defId: placing.defId, x, y, rot: placing.rot });
    if (!error && (useGame.getState().farm.inventory.items[placing.defId] ?? 0) === 0)
      ui.stopPlacing();
  } else if ("move" in source) {
    const home = housingTarget(placing, hover);
    error = home
      ? game.dispatch({ type: "house", id: source.move, buildingId: home.id })
      : game.dispatch({ type: "move", id: source.move, x, y, rot: placing.rot });
    if (!error) {
      ui.stopPlacing();
      ui.setTool("arrange");
      if (home) toast(`Moved into the ${getDef(home.defId)?.name ?? "building"} 🏠`);
    }
  } else {
    error = game.dispatch({
      type: "release",
      buildingId: source.release.buildingId,
      occupantId: source.release.occupantId,
      x,
      y,
      rot: placing.rot,
    });
    if (!error) ui.stopPlacing();
  }
  if (error) toast(describeError(error));
}

/** Arrange tool: pick up whatever is on the tile. */
export function pickUp(tile: Tile) {
  const farm = projectedState(useGame.getState().projection);
  const obj = objectAt(farm, tile.x, tile.y);
  if (!obj) return;
  useUi.getState().startPlacing({ defId: obj.defId, rot: obj.rot, source: { move: obj.id } });
}

/** Sell tool: confirm, then sell (or clear a plot). */
export function sellAt(tile: Tile) {
  const obj = objectAt(useGame.getState().farm, tile.x, tile.y);
  if (obj) sellObject(obj);
}

function sellObject(obj: FarmObject) {
  const sell = () => {
    const error = useGame.getState().dispatch({ type: "sell", id: obj.id });
    if (error) toast(describeError(error));
  };
  if (obj.kind === "plot") {
    toast("Remove this plot?", { action: { label: "Remove", onClick: sell } });
    return;
  }
  const def = getPlaceable(obj.defId);
  if (!def) return;
  if (!def.sellable) {
    toast(`${def.name} can't be sold.`);
    return;
  }
  toast(`Sell ${def.icon} ${def.name}?`, {
    description: `You'll get 🪙${sellValue(def).toLocaleString()} back.`,
    action: { label: "Sell", onClick: sell },
  });
}

/** Multi-tool on a building that has nothing to collect: open its details. */
export function openBuildingAt(tile: Tile): boolean {
  const obj = objectAt(useGame.getState().farm, tile.x, tile.y);
  if (obj?.kind !== "building") return false;
  if (getBuilding(obj.defId)?.role.type === "storage") useUi.getState().openDialog("storage");
  else useUi.getState().openBuilding(obj.id);
  return true;
}

/** The area a vehicle pass would cover when aimed at `hover` (centered on it). */
export function driveArea(hover: Tile): { x: number; y: number; side: number } | null {
  const { vehicleId } = useUi.getState();
  const vehicle = vehicleId ? useGame.getState().farm.objects[vehicleId] : undefined;
  if (vehicle?.kind !== "vehicle") return null;
  const side = getVehicle(vehicle.defId)?.area[vehicle.tier - 1] ?? 2;
  const offset = Math.floor((side - 1) / 2);
  return { x: hover.x - offset, y: hover.y - offset, side };
}

/** Vehicles tool: queue a pass over the area around the tile. */
export function driveAt(tile: Tile) {
  const ui = useUi.getState();
  const area = driveArea(tile);
  if (!area || !ui.vehicleId) {
    toast("Pick a vehicle first 🚜");
    return;
  }
  const vehicle = useGame.getState().farm.objects[ui.vehicleId];
  const op = vehicle?.kind === "vehicle" ? getVehicle(vehicle.defId)?.op : undefined;
  const error = useGame.getState().enqueue({
    type: "drive",
    vehicleId: ui.vehicleId,
    x: area.x,
    y: area.y,
    ...(op === "plant" || op === "combine" ? { cropId: ui.seedId } : {}),
  });
  if (error) toast(describeError(error));
}

/**
 * A tap on a roaming animal. Farm tool: collect if ready (free animals send the farmer to the
 * animal; housed ones are collected through their home), otherwise say when. Arrange: pick it up
 * (or let it out of its home). Sell: sell a free animal.
 */
/** Visiting: do the chore on this tile of the neighbour's farm. */
export function helpAt(tile: Tile) {
  const game = useGame.getState();
  const visit = game.visit;
  if (!visit) return;
  const error = game.dispatch({ type: "helpNeighbor", npcId: visit.npcId, x: tile.x, y: tile.y });
  if (error) {
    toast(
      error.code === "NOTHING_TO_DO"
        ? "That's all the help they need today. Come back tomorrow!"
        : error.code === "NO_TARGET"
          ? "Nothing to do there. Look for 🤝 and ready animals."
          : describeError(error),
    );
    return;
  }
  game.refreshVisit();
}

/** Fertilizer tool: spread a sack over the 3×3 patch around the tile. */
export function fertilizeAt(tile: Tile) {
  const error = useGame.getState().dispatch({ type: "fertilize", x: tile.x, y: tile.y });
  if (error) {
    toast(
      error.code === "NOTHING_TO_DO"
        ? "Aim at growing crops that aren't manured yet."
        : describeError(error),
    );
    return;
  }
  if ((useGame.getState().farm.materials.fertilizer_sack ?? 0) === 0)
    useUi.getState().setTool("hand");
}

export function animalTap(id: string, tool: string) {
  // On a neighbour's farm, clicking one of their animals collects it for them.
  const visit = useGame.getState().visit;
  if (visit) {
    const spot = animalSpots(visit.farm, clock.now()).find((s) => s.id === id);
    if (spot) helpAt(spot.home);
    return;
  }
  // Neighbours share the pick registry: any click opens their quest card.
  if (id.startsWith("npc:")) {
    useUi.setState({ questNpc: id.slice(4), dialog: "quest" });
    return;
  }
  const game = useGame.getState();
  const farm = game.farm;
  const now = clock.now();
  const spot = animalSpots(farm, now).find((s) => s.id === id);
  if (!spot) return;
  const producer = getProducer(spot.defId);
  if (tool === "arrange") {
    if (spot.housed) {
      useUi.getState().startPlacing({
        defId: spot.defId,
        rot: 0,
        source: { release: { buildingId: spot.homeId, occupantId: id as ObjectId } },
      });
    } else {
      useUi
        .getState()
        .startPlacing({ defId: spot.defId, rot: 0, source: { move: id as ObjectId } });
    }
    return;
  }
  if (tool === "sell") {
    const obj = farm.objects[id as ObjectId];
    if (obj) sellObject(obj);
    else toast("Let it out of its home first (Arrange it), then sell it.");
    return;
  }
  if (!producer) return;
  const status = producerStatus(spot.cycleStart, producer.cycleMs, now);
  if (!status.ready) {
    toast(`${producer.icon} ${producer.name}`, {
      description: `Next ${producer.product.icon} ${producer.product.name} in ${formatDuration(status.readyAt - now)}`,
    });
    return;
  }
  let error = null;
  if (spot.housed) {
    const home = farm.objects[spot.homeId];
    if (home) error = game.enqueue({ type: "harvest", x: home.x, y: home.y, expect: home.id });
  } else {
    error = game.enqueue({
      type: "collectAnimal",
      id: id as ObjectId,
      x: spot.tile.x,
      y: spot.tile.y,
    });
  }
  if (error) toast(describeError(error));
}
