import { DAY, MINUTE } from "../constants";
import type { Ms } from "../types/ids";

/** The player's local calendar day number for a timestamp. */
export const dayIndex = (now: Ms, offsetMin: number): number =>
  Math.floor((now + offsetMin * MINUTE) / DAY);

/** True if `stamp` (a stored ms time) falls on the same local day as `now`. */
export const isToday = (stamp: Ms | null, now: Ms, offsetMin: number): boolean =>
  stamp !== null && dayIndex(stamp, offsetMin) === dayIndex(now, offsetMin);
