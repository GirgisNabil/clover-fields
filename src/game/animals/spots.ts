import {
  dayIndex,
  type FarmState,
  getProducer,
  isRestTime,
  type ObjectId,
  type Roamer,
  roamers,
  type Tile,
  visitTile,
  windowOf,
} from "@/domain";

/** One animal the world draws: a free animal, or a housed animal that's out roaming today. */
export interface AnimalSpot {
  id: string;
  defId: string;
  /** Where the rules say it is this window (its visit tile, or home at night). */
  tile: Tile;
  home: Tile;
  homeId: ObjectId;
  /** Housed animals go inside their building at night. */
  housed: boolean;
  resting: boolean;
  cycleStart: number;
  /** Moths and animals without a home flutter or doze in place. */
  roams: boolean;
}

let cache: { objects: object; window: number; rest: boolean; spots: AnimalSpot[] } | null = null;

/**
 * Every drawn animal and where it is in the current visit window. Recomputed only when the
 * farm's objects or the window change, so components can call it every frame.
 */
export function animalSpots(farm: FarmState, now: number): AnimalSpot[] {
  const window = windowOf(now);
  const rest = isRestTime(now, farm.meta.dayOffsetMin);
  if (cache && cache.objects === farm.objects && cache.window === window && cache.rest === rest) {
    return cache.spots;
  }
  const out = roamers(farm, dayIndex(now, farm.meta.dayOffsetMin));
  const byId = new Map<string, Roamer>(out.map((r) => [r.id, r]));
  const spots: AnimalSpot[] = [];
  for (const obj of Object.values(farm.objects)) {
    if (obj.kind === "animal") {
      const roamer = byId.get(obj.id);
      const home = { x: obj.x, y: obj.y };
      spots.push({
        id: obj.id,
        defId: obj.defId,
        tile: roamer && !rest ? visitTile(farm, roamer, window) : home,
        home,
        homeId: obj.id,
        housed: false,
        resting: rest || !roamer,
        cycleStart: obj.cycleStart,
        roams: roamer !== undefined,
      });
    } else if (obj.kind === "building") {
      for (const occupant of obj.occupants) {
        const roamer = byId.get(occupant.id);
        if (!roamer || getProducer(occupant.defId)?.kind !== "animal") continue;
        spots.push({
          id: occupant.id,
          defId: occupant.defId,
          tile: rest ? roamer.home : visitTile(farm, roamer, window),
          home: roamer.home,
          homeId: obj.id,
          housed: true,
          resting: rest,
          cycleStart: occupant.cycleStart,
          roams: true,
        });
      }
    }
  }
  spots.sort((a, b) => (a.id < b.id ? -1 : 1));
  cache = { objects: farm.objects, window, rest, spots };
  return spots;
}
