import {
  type FarmState,
  getNpc,
  getProducer,
  npcsWithQuests,
  type ObjectStatus,
  producerStatus,
} from "@/domain";
import { animalSpots } from "../animals/spots";

const manureNote = (by: string | null) =>
  by ? ` · 🌱 Manured by ${by}: ripens sooner, +15% coins` : "";

/** Tooltip text for a neighbour waiting at the farm's edge (`npc:<id>`). */
function describeNpc(farm: FarmState, id: string) {
  const npc = getNpc(id);
  if (!npc) return null;
  const ready = npcsWithQuests(farm).find((n) => n.npc === id)?.claimable;
  return {
    title: `${npc.icon} ${npc.name}`,
    detail: ready ? "❗ A reward is waiting for you!" : `${npc.role} · has a task for you`,
  };
}

/** Tooltip text for a roaming animal. */
export function describeAnimal(
  farm: FarmState,
  id: string,
  now: number,
): { title: string; detail: string } | null {
  if (id.startsWith("npc:")) return describeNpc(farm, id.slice(4));
  const spot = animalSpots(farm, now).find((s) => s.id === id);
  const def = spot ? getProducer(spot.defId) : undefined;
  if (!spot || !def) return null;
  const status = producerStatus(spot.cycleStart, def.cycleMs, now);
  const product = status.ready
    ? `${def.product.icon} Ready to collect!`
    : `Next ${def.product.icon} in ${formatDuration(status.readyAt - now)}`;
  const mood = !spot.roams ? "" : spot.resting ? " · resting 💤" : " · out roaming";
  return { title: `${def.icon} ${def.name}`, detail: product + mood };
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

/** Human text for a tile, used by the tooltip and tap-to-inspect. */
export function describeStatus(
  status: ObjectStatus,
  now: number,
): { title: string; detail: string } | null {
  switch (status.kind) {
    case "grass":
      return null;
    case "fallow":
      return { title: "Fallow soil", detail: "Plow it to plant again." };
    case "plowed":
      return { title: "Plowed soil", detail: "Ready for seeds." };
    case "growing":
      return {
        title: `${status.icon} ${status.name}`,
        detail: `Ready in ${formatDuration(status.readyAt - now)}${manureNote(status.manuredBy)}`,
      };
    case "ripe":
      return {
        title: `${status.icon} ${status.name}`,
        detail:
          (status.protected
            ? "Ready to harvest!"
            : `Ready! Harvest within ${formatDuration(status.witherAt - now)}`) +
          manureNote(status.manuredBy),
      };
    case "withered":
      return { title: `🥀 Withered ${status.name}`, detail: "Plow over it to clear the plot." };
    case "producer":
      return {
        title: `${status.icon} ${status.name}`,
        detail: status.ready
          ? `${status.product} Ready to collect!`
          : `Next ${status.product} in ${formatDuration(status.readyAt - now)}`,
      };
    case "building":
      return {
        title: `${status.icon} ${status.name}`,
        detail:
          status.readyCount > 0
            ? `${status.readyCount} ready to collect`
            : status.crafting
              ? status.nextReadyAt
                ? `${status.occupants}/${status.capacity} jobs · next in ${formatDuration(status.nextReadyAt - now)}`
                : "Idle · click to craft"
              : `${status.occupants}/${status.capacity} inside`,
      };
    case "decoration":
      return { title: `${status.icon} ${status.name}`, detail: "Decoration" };
    case "vehicle":
      return {
        title: `${status.icon} ${status.name}`,
        detail: `Works ${status.area}×${status.area} tiles · pick it with the Vehicles tool (V)`,
      };
  }
}
