import type { Reward } from "../rules/reward";

// Questlines: short chains of steps given by a neighbour. Goals read stats and farm state, so
// progress needs no bookkeeping of its own. `count` goals measure from the moment the step began.

export type Goal =
  | { kind: "count"; stat: string; n: number; label: string }
  | { kind: "own"; defId: string; n: number; label: string }
  | { kind: "ownKind"; objectKind: "decoration" | "plot" | "animal"; n: number; label: string }
  | { kind: "level"; n: number; label: string }
  | { kind: "stars"; n: number; label: string }
  | { kind: "expand"; n: number; label: string }
  /** Hand over materials when claiming (they are used up). */
  | { kind: "deliver"; id: string; n: number; label: string };

export interface QuestStep {
  title: string;
  /** What the neighbour says. */
  text: string;
  goals: readonly Goal[];
  reward: Reward;
  /** Claimed automatically the moment it's done (tutorial steps). */
  auto?: boolean;
}

export interface QuestLine {
  id: string;
  npc: string;
  name: string;
  unlockLevel: number;
  /** Starts only after this line is finished. */
  after?: string;
  /** Beginner lines are quietly marked done (no reward) for farms already past this level. */
  skipFrom?: number;
  /** Starts only while this seasonal event runs. */
  event?: string;
  steps: readonly QuestStep[];
}

/** At most this many lines run at once; the rest wait their turn, in catalog order. */
export const MAX_ACTIVE_QUESTS = 4;

const count = (stat: string, n: number, label: string): Goal => ({ kind: "count", stat, n, label });
const own = (defId: string, n: number, label: string): Goal => ({ kind: "own", defId, n, label });

export const QUESTS: readonly QuestLine[] = [
  {
    id: "welcome",
    npc: "marigold",
    name: "Welcome to Clover Fields",
    unlockLevel: 1,
    skipFrom: 4,
    steps: [
      {
        title: "First harvest",
        text: "Welcome home, dear! Those clover sprouts are ripe already. Click or drag across them to harvest.",
        goals: [count("harvest:crop", 4, "Harvest 4 crops")],
        reward: { coins: 50, xp: 5 },
        auto: true,
      },
      {
        title: "Turn the soil",
        text: "Lovely! Now pick the Plow and drag across the grass to make new plots.",
        goals: [count("plow", 4, "Plow 4 plots")],
        reward: { coins: 60, xp: 5 },
        auto: true,
      },
      {
        title: "Sow some seeds",
        text: "Open Seeds, choose something cheerful, then drag across plowed soil to plant.",
        goals: [count("plant", 4, "Plant 4 seeds")],
        reward: { coins: 80, xp: 8 },
        auto: true,
      },
      {
        title: "Breakfast is served",
        text: "Your hen has laid an egg. Click her wherever she's wandered to collect it.",
        goals: [count("collect:animal", 1, "Collect from your hen")],
        reward: { coins: 60, xp: 8 },
        auto: true,
      },
      {
        title: "A splash of color",
        text: "I left you a Daisy Bed in the Tool Shed. Open the Shed and place it somewhere pretty.",
        goals: [own("daisy_bed", 1, "Place the Daisy Bed")],
        reward: { coins: 150, xp: 15, clovers: 1 },
        auto: true,
      },
    ],
  },
  {
    id: "green_fingers",
    npc: "marigold",
    name: "Green Fingers",
    unlockLevel: 2,
    after: "welcome",
    steps: [
      {
        title: "Busy fields",
        text: "A good farmer keeps the soil busy. Bring in a proper harvest.",
        goals: [count("harvest:crop", 15, "Harvest 15 crops")],
        reward: { coins: 200, xp: 20 },
      },
      {
        title: "Room to grow",
        text: "More plots, more harvests. Let's get the farm properly laid out.",
        goals: [{ kind: "ownKind", objectKind: "plot", n: 16, label: "Have 16 plots" }],
        reward: { coins: 300, xp: 30 },
      },
      {
        title: "A star is born",
        text: "Grow one crop over and over and you'll master it. Earn your first mastery star!",
        goals: [{ kind: "stars", n: 1, label: "Earn 1 mastery star" }],
        reward: { coins: 400, xp: 40 },
      },
    ],
  },
  {
    id: "hollis_lanterns",
    npc: "hollis",
    name: "Light Up the Valley",
    unlockLevel: 5,
    event: "lantern_fair",
    steps: [
      {
        title: "Lantern gourds",
        text: "The Lantern Harvest Fair is here! Plant Lantern Gourds. They glow, and they earn three times the tokens.",
        goals: [
          { kind: "count", stat: "harvest:lantern_gourd", n: 6, label: "Harvest 6 Lantern Gourds" },
        ],
        reward: { coins: 400, xp: 40 },
      },
      {
        title: "Token collector",
        text: "Every harvest and collection earns Lantern Tokens. Gather plenty for the fair shop!",
        goals: [{ kind: "count", stat: "event:tokens", n: 80, label: "Earn 80 Lantern Tokens" }],
        reward: { coins: 700, xp: 70 },
      },
      {
        title: "Festive spirit",
        text: "Buy something lovely from the fair shop and show the valley your festive spirit!",
        goals: [{ kind: "count", stat: "event:buy", n: 1, label: "Buy from the fair shop" }],
        reward: { coins: 1000, xp: 100, clovers: 2 },
      },
    ],
  },
  {
    id: "dot_deliveries",
    npc: "dot",
    name: "Special Delivery",
    unlockLevel: 3,
    steps: [
      {
        title: "Honk!",
        text: "HONK. (Dot drops a letter: 'Neighbours are watching. Make it nice.') HONK.",
        goals: [{ kind: "ownKind", objectKind: "decoration", n: 5, label: "Have 5 decorations" }],
        reward: { coins: 250, xp: 25 },
      },
      {
        title: "More land, more mail",
        text: "HONK! (A map of the land beyond your fence. Someone has circled it twice.)",
        goals: [{ kind: "expand", n: 1, label: "Expand your farm once" }],
        reward: { coins: 600, xp: 60, clovers: 1 },
      },
    ],
  },
  {
    id: "feathered_friends",
    npc: "marigold",
    name: "Feathered Friends",
    unlockLevel: 6,
    after: "green_fingers",
    steps: [
      {
        title: "A proper flock",
        text: "One hen is lonely. Three is a flock! They'll wander about and fertilize your crops.",
        goals: [own("russet_hen", 3, "Own 3 Russet Hens")],
        reward: { coins: 400, xp: 40 },
      },
      {
        title: "A roof over their heads",
        text: "Build a Hen House. Some of them will roam out each day, the rest stay snug inside.",
        goals: [own("hen_house", 1, "Build a Hen House")],
        reward: { coins: 600, xp: 60 },
      },
      {
        title: "Egg basket",
        text: "Keep those birds happy and collect, collect, collect!",
        goals: [count("collect:animal", 15, "Collect from animals 15 times")],
        reward: { coins: 800, xp: 80 },
      },
    ],
  },
  {
    id: "hollis_pride",
    npc: "hollis",
    name: "Pride of the Valley",
    unlockLevel: 5,
    steps: [
      {
        title: "Civic beauty",
        text: "As mayor, I simply must ask: could your farm be a little more… splendid?",
        goals: [{ kind: "ownKind", objectKind: "decoration", n: 10, label: "Have 10 decorations" }],
        reward: { coins: 500, xp: 50 },
      },
      {
        title: "A thriving economy",
        text: "Splendid! Now show the valley what a farm can earn.",
        goals: [count("coins:earned", 3000, "Earn 3,000 coins")],
        reward: { coins: 800, xp: 80, clovers: 1 },
      },
    ],
  },
  {
    id: "juniper_keepsakes",
    npc: "juniper",
    name: "Little Treasures",
    unlockLevel: 7,
    steps: [
      {
        title: "Keep your eyes open",
        text: "The valley is full of little lost things. Harvest, collect and plow, and you'll find some.",
        goals: [count("collect:find", 3, "Find 3 keepsakes")],
        reward: { coins: 500, xp: 50 },
      },
      {
        title: "A complete set",
        text: "Gather all six of a set, then turn it in from your Farm Book. Trade your spares if you're stuck!",
        goals: [count("collect:redeem", 1, "Turn in a collection")],
        reward: { coins: 1200, xp: 120, clovers: 1 },
      },
    ],
  },
  {
    id: "living_fields",
    npc: "marigold",
    name: "Living Fields",
    unlockLevel: 8,
    after: "feathered_friends",
    steps: [
      {
        title: "Nature's helpers",
        text: "Animals that wander your fields leave them richer. Let them roam near your crops!",
        goals: [count("harvest:manured", 5, "Harvest 5 manured crops")],
        reward: { coins: 700, xp: 70 },
      },
      {
        title: "Fence them in",
        text: "Fences steer animals. Build a pen beside your best field so they fertilize it.",
        goals: [own("rail_fence", 12, "Have 12 fence pieces")],
        reward: { coins: 900, xp: 90 },
      },
    ],
  },
  {
    id: "pip_engines",
    npc: "pip",
    name: "Engines and Elbow Grease",
    unlockLevel: 12,
    steps: [
      {
        title: "Your first ride",
        text: "Hiya! Pip Sprocket, mechanic. You look like someone who needs a tractor.",
        goals: [own("clodbuster_tractor", 1, "Buy a Clodbuster Tractor")],
        reward: { coins: 800, xp: 80 },
      },
      {
        title: "Put it to work",
        text: "Press V, pick the tractor and click a patch of grass. Watch it go!",
        goals: [count("vehicle:tiles", 20, "Work 20 tiles with vehicles")],
        reward: { coins: 1000, xp: 100 },
      },
      {
        title: "The full fleet",
        text: "A seeder plants as fast as the tractor plows. Want one?",
        goals: [own("sprinkle_seeder", 1, "Buy a Sprinkle Seeder")],
        reward: { coins: 1500, xp: 150, materials: { brass_cog: 2 } },
      },
    ],
  },
  {
    id: "barnaby_mill",
    npc: "barnaby",
    name: "Flour Power",
    unlockLevel: 15,
    steps: [
      {
        title: "Raise a mill",
        text: "Barnaby Quill, at your service. Bushels are wasted sitting in a sack. Build a mill!",
        goals: [own("windgrist_mill", 1, "Build a Windgrist Mill")],
        reward: { coins: 1200, xp: 120 },
      },
      {
        title: "Fine and fluffy",
        text: "Mill some wheat into flour. You'll find bushels when you harvest.",
        goals: [count("craft:done", 3, "Craft 3 goods")],
        reward: { coins: 1500, xp: 150 },
      },
      {
        title: "A baker's dozen",
        text: "My oven's cold and my customers are hungry. Could you spare some flour?",
        goals: [{ kind: "deliver", id: "wheat_flour", n: 2, label: "Deliver 2 Wheat Flour" }],
        reward: { coins: 2500, xp: 250, clovers: 1 },
      },
    ],
  },
];

export const getQuest = (id: string) => QUESTS.find((q) => q.id === id);
