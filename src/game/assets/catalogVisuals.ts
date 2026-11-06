import type { ModelKey } from "./manifest";

/** How a model is sized onto the farm. */
export type Fit =
  /** Fill the item's footprint (times `margin`) without distortion. */
  | { mode: "footprint"; margin?: number }
  /** Scale so the model is `value` tiles tall. */
  | { mode: "height"; value: number }
  /** Scale so the longest horizontal side is `value` tiles. */
  | { mode: "length"; value: number };

export interface ModelVisual {
  model: ModelKey;
  fit: Fit;
  /** Extra turn (radians) so the model's front faces the camera at rotation 0. */
  rotY?: number;
  /** Idle clips to cycle between, if the model is animated. */
  idle?: readonly string[];
  /** Shift from the footprint center, in tiles, before the object's rotation (x along its front). */
  at?: readonly [number, number];
  /** More models drawn with this one, e.g. a wagon behind a tractor. */
  extra?: readonly ModelVisual[];
}

const LARGE = ["Idle", "Eating"] as const;
const IDLE = ["Idle"] as const;

// KayKit vehicles are modelled along +z; a quarter turn points them along the object's +x.
const ALONG_X = Math.PI / 2;
const tractor = (length: number, x: number): ModelVisual => ({
  model: "vehicle_tractor",
  fit: { mode: "length", value: length },
  rotY: ALONG_X,
  at: [x, 0],
});
const wagon = (model: "vehicle_wagon" | "vehicle_wagon_hay", length: number, x: number) => ({
  model,
  fit: { mode: "length", value: length } as const,
  rotY: ALONG_X,
  at: [x, 0] as const,
});

/** Catalog items drawn with third-party models; everything else uses procedural models. */
export const OBJECT_VISUALS: Readonly<Record<string, ModelVisual>> = {
  // Animals
  russet_hen: { model: "animal_hen", fit: { mode: "height", value: 0.62 } },
  puddle_duck: { model: "animal_duck", fit: { mode: "height", value: 0.55 } },
  nanny_goat: { model: "animal_goat", fit: { mode: "length", value: 1.05 } },
  puffwool_sheep: { model: "animal_sheep", fit: { mode: "length", value: 1.25 }, idle: IDLE },
  truffle_pig: { model: "animal_pig", fit: { mode: "length", value: 1.2 }, idle: IDLE },
  dapple_cow: { model: "animal_cow", fit: { mode: "length", value: 1.85 }, idle: LARGE },
  meadow_donkey: { model: "animal_donkey", fit: { mode: "length", value: 1.7 }, idle: LARGE },
  chestnut_horse: { model: "animal_horse", fit: { mode: "length", value: 1.9 }, idle: LARGE },
  velvet_rabbit: { model: "animal_rabbit", fit: { mode: "length", value: 0.7 } },
  hilltop_llama: { model: "animal_llama", fit: { mode: "height", value: 1.6 }, idle: IDLE },
  moonfleece_alpaca: { model: "animal_alpaca", fit: { mode: "length", value: 1.5 }, idle: LARGE },
  shaggy_yak: { model: "animal_bull", fit: { mode: "length", value: 1.95 }, idle: LARGE },

  // Buildings
  tool_shed: { model: "building_shed", fit: { mode: "footprint", margin: 0.95 } },
  hen_house: { model: "building_coop", fit: { mode: "footprint", margin: 0.92 } },
  red_barn: { model: "building_barn", fit: { mode: "footprint", margin: 0.95 } },
  hoofbeat_stable: { model: "building_stable", fit: { mode: "footprint", margin: 0.95 } },
  windgrist_mill: { model: "building_mill", fit: { mode: "footprint", margin: 0.98 } },
  crumbhearth_bakery: { model: "building_bakery", fit: { mode: "footprint", margin: 0.98 } },
  pippin_press: { model: "building_press", fit: { mode: "footprint", margin: 1 } },
  gearhouse_garage: { model: "building_garage", fit: { mode: "footprint", margin: 0.95 } },

  // Vehicles: a tractor alone, or pulling a wagon
  clodbuster_tractor: tractor(1.6, 0),
  sprinkle_seeder: { ...tractor(1.0, 0.48), extra: [wagon("vehicle_wagon", 1.05, -0.5)] },
  reapwell_harvester: { ...tractor(1.0, 0.48), extra: [wagon("vehicle_wagon_hay", 1.05, -0.5)] },
  triplet_combine: { ...tractor(1.4, 0.78), extra: [wagon("vehicle_wagon_hay", 1.5, -0.72)] },

  // Decorations
  rail_fence: { model: "decor_fence", fit: { mode: "length", value: 1 } },
  stepping_stones: { model: "decor_stones", fit: { mode: "footprint", margin: 0.95 } },
  rain_barrel: { model: "decor_barrel", fit: { mode: "height", value: 0.6 } },
  straw_sentinel: { model: "decor_scarecrow", fit: { mode: "height", value: 1.25 } },
  lantern_post: { model: "decor_lantern", fit: { mode: "height", value: 1.5 } },
  garden_bench: { model: "decor_bench", fit: { mode: "footprint", margin: 0.85 } },
  wishing_well: { model: "decor_well", fit: { mode: "footprint", margin: 0.75 } },
  little_windmill: { model: "decor_windmill", fit: { mode: "footprint", margin: 0.9 } },
  stone_fountain: { model: "decor_fountain", fit: { mode: "footprint", margin: 0.9 } },
  garden_gazebo: { model: "decor_gazebo", fit: { mode: "footprint", margin: 0.9 } },
  stone_bridge: { model: "decor_bridge", fit: { mode: "footprint", margin: 0.95 } },
  horse_statue: { model: "decor_horse_statue", fit: { mode: "footprint", margin: 0.85 } },
  market_stall: { model: "decor_market_stall", fit: { mode: "footprint", margin: 0.95 } },
  garden_cottage: { model: "decor_cottage", fit: { mode: "footprint", margin: 0.95 } },

  // Seasonal event items
  lantern_hen: { model: "animal_hen", fit: { mode: "height", value: 0.68 } },
  harvest_haystack: { model: "decor_haybale", fit: { mode: "footprint", margin: 0.95 } },
  jack_sentinel: { model: "decor_scarecrow", fit: { mode: "height", value: 1.3 } },
  frosted_fir: { model: "scenery_pine", fit: { mode: "height", value: 1.9 } },
  snow_lantern: { model: "decor_lantern", fit: { mode: "height", value: 1.5 } },
  frost_fountain: { model: "decor_fountain", fit: { mode: "footprint", margin: 0.9 } },
  blossom_bench: { model: "decor_bench", fit: { mode: "footprint", margin: 0.85 } },
  petal_well: { model: "decor_well", fit: { mode: "footprint", margin: 0.75 } },
  blossom_gazebo: { model: "decor_gazebo", fit: { mode: "footprint", margin: 0.9 } },
  sun_barrel: { model: "decor_barrel", fit: { mode: "height", value: 0.6 } },
  sun_windmill: { model: "decor_windmill", fit: { mode: "footprint", margin: 0.9 } },
  sun_statue_fountain: { model: "decor_fountain", fit: { mode: "footprint", margin: 0.9 } },
};

export const FARMER_VISUAL: ModelVisual = {
  model: "farmer",
  fit: { mode: "height", value: 1.15 },
  // The farmer model faces +z; the controller's heading assumes +x.
  rotY: Math.PI / 2,
};
