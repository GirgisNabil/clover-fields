export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const PLOW_COST = 10;
export const PLOW_XP = 1;
export const MAX_LEVEL = 50;
/** Crops planted below this level never wither. */
export const BEGINNER_LEVEL = 6;
export const MAX_QUEUE = 100;
export const START_SIZE = 12;
export const START_COINS = 600;
export const START_CLOVERS = 5;

/** Ripe crops are safe for `safeMult` × grow time, then wither somewhere in the next `cushionMult` × grow time. */
export const WITHER = {
  safeMult: 1,
  cushionMult: 0.5,
  minSafe: 20 * MINUTE,
  minCushion: 10 * MINUTE,
} as const;

export const SELL_RATE = { producer: 0.05, decoration: 0.1, building: 0.1 } as const;
/** Coins refunded per Golden Clover when selling clover-priced items. */
export const CLOVER_SELL_COINS = 25;
/** XP granted per Golden Clover spent on placeable items. */
export const XP_PER_CLOVER = 30;
