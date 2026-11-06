import { EVENTS, type EventDef, eventWindow, getEvent, TOKEN_COIN_VALUE } from "../catalog/events";
import { FEATURE_LEVEL } from "../catalog/levels";
import type { Emit } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";
import { bumpStat, credit } from "./progression";

export interface ActiveEvent {
  def: EventDef;
  /** The year this edition started (windows can run past New Year). */
  edition: number;
  start: Ms;
  end: Ms;
}

/** The event running at `now`, if any (windows are UTC and never overlap). */
export function activeEvent(now: Ms): ActiveEvent | null {
  const year = new Date(now).getUTCFullYear();
  for (const def of EVENTS) {
    for (const edition of [year, year - 1]) {
      const { start, end } = eventWindow(def, edition);
      if (now >= start && now < end) return { def, edition, start, end };
    }
  }
  return null;
}

/** The next event to start after `now` (for "coming soon"). */
export function nextEvent(now: Ms): ActiveEvent {
  const year = new Date(now).getUTCFullYear();
  const upcoming = EVENTS.flatMap((def) =>
    [year, year + 1].map((edition) => ({ def, edition, ...eventWindow(def, edition) })),
  )
    .filter((e) => e.start > now)
    .sort((a, b) => a.start - b.start);
  return upcoming[0] as ActiveEvent;
}

/** Event tokens held for the running event (0 if none). */
export function tokensNow(state: FarmState, now: Ms): number {
  const active = activeEvent(now);
  if (!active) return 0;
  const record = state.events[active.def.id];
  return record && record.edition === active.edition && !record.settled ? record.tokens : 0;
}

/** Adds tokens for the running event (from the events level on). */
export function earnTokens(draft: FarmState, n: number, emit: Emit, now: Ms) {
  if (n <= 0 || draft.progress.level < FEATURE_LEVEL.events) return;
  const active = activeEvent(now);
  if (!active) return;
  const id = active.def.id;
  const record = draft.events[id];
  if (!record || record.edition !== active.edition) {
    draft.events[id] = { edition: active.edition, tokens: 0, settled: false };
  }
  const target = draft.events[id];
  if (!target) return;
  target.tokens += n;
  bumpStat(draft, "event:tokens", n);
  emit({ t: "eventTokens", eventId: id, delta: n, total: target.tokens });
}

/** Before every command: once an edition is over, its leftover tokens become coins (once). */
export function settleEvents(draft: FarmState, emit: Emit, now: Ms) {
  for (const [id, record] of Object.entries(draft.events)) {
    if (record.settled) continue;
    const def = getEvent(id);
    if (!def || now < eventWindow(def, record.edition).end) continue;
    const coins = record.tokens * TOKEN_COIN_VALUE;
    record.settled = true;
    emit({ t: "eventSettled", eventId: id, tokens: record.tokens, coins });
    if (coins > 0) credit(draft, coins, emit, "event");
    record.tokens = 0;
  }
}
