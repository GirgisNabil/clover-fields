// The game's single source of time. Production uses the real clock; development
// and e2e builds add a skip offset (and can freeze time) for testing long timers.

export const DEV_TOOLS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

let offset = 0;
let frozenAt: number | null = null;

export const clock = {
  now(): number {
    if (!DEV_TOOLS) return Date.now();
    return frozenAt ?? Date.now() + offset;
  },
  /** Moves game time forward (dev only). */
  advance(ms: number) {
    if (!DEV_TOOLS) return;
    if (frozenAt !== null) frozenAt += ms;
    else offset += ms;
  },
  freeze() {
    if (DEV_TOOLS) frozenAt = clock.now();
  },
  unfreeze() {
    if (!DEV_TOOLS || frozenAt === null) return;
    offset = frozenAt - Date.now();
    frozenAt = null;
  },
  offset: () => offset,
};
