import { FEATURE_LEVEL } from "./levels";

// The daily bonus: one claim per local day on a 7-day streak cycle (a missed day restarts it),
// plus three small daily tasks picked from a pool.

export interface DailyReward {
  coins?: number;
  fuel?: number;
  clovers?: number;
  materials?: Readonly<Record<string, number>>;
}

/** Coins grow with level so the bonus stays worth opening. */
const scale = (coins: number, level: number) => Math.round((coins * (1 + level / 20)) / 5) * 5;

/** The reward for day `day` (0–6) of the cycle at a given level. */
export function dailyReward(day: number, level: number): DailyReward {
  switch (day % 7) {
    case 0:
      return { coins: scale(150, level) };
    case 1:
      return { materials: { fertilizer_sack: 2 } };
    case 2:
      return { coins: scale(300, level) };
    case 3:
      // Fuel is only useful once vehicles unlock; before that it's coins.
      return level >= FEATURE_LEVEL.vehicles ? { fuel: 10 } : { coins: scale(200, level) };
    case 4:
      return { coins: scale(500, level) };
    case 5:
      return { materials: { brass_cog: 1 } };
    default:
      return { clovers: 1 };
  }
}

export interface DailyTaskDef {
  id: string;
  label: string;
  stat: string;
  n: number;
  minLevel: number;
  coins: number;
}

export const DAILY_TASKS: readonly DailyTaskDef[] = [
  {
    id: "harvest20",
    label: "Harvest 20 crops",
    stat: "harvest:crop",
    n: 20,
    minLevel: 1,
    coins: 120,
  },
  { id: "plant20", label: "Plant 20 seeds", stat: "plant", n: 20, minLevel: 1, coins: 100 },
  { id: "plow15", label: "Plow 15 plots", stat: "plow", n: 15, minLevel: 1, coins: 100 },
  {
    id: "animals5",
    label: "Collect from animals 5 times",
    stat: "collect:animal",
    n: 5,
    minLevel: 2,
    coins: 120,
  },
  {
    id: "trees3",
    label: "Collect from fruit trees 3 times",
    stat: "collect:tree",
    n: 3,
    minLevel: 3,
    coins: 100,
  },
  {
    id: "help5",
    label: "Help neighbours 5 times",
    stat: "neighbor:help",
    n: 5,
    minLevel: 4,
    coins: 150,
  },
  {
    id: "earn2000",
    label: "Earn 2,000 coins",
    stat: "coins:earned",
    n: 2000,
    minLevel: 5,
    coins: 200,
  },
  {
    id: "manure5",
    label: "Harvest 5 manured crops",
    stat: "harvest:manured",
    n: 5,
    minLevel: 6,
    coins: 180,
  },
  { id: "find2", label: "Find 2 keepsakes", stat: "collect:find", n: 2, minLevel: 7, coins: 200 },
  { id: "craft3", label: "Craft 3 goods", stat: "craft:done", n: 3, minLevel: 15, coins: 300 },
  {
    id: "drive30",
    label: "Work 30 tiles with vehicles",
    stat: "vehicle:tiles",
    n: 30,
    minLevel: 12,
    coins: 250,
  },
];

/** Finishing all three of the day's tasks also pays this. */
export const DAILY_BONUS = { coins: 300, xp: 40, clovers: 1 } as const;
export const DAILY_TASK_COUNT = 3;
