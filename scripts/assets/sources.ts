// Third-party 3D models used by the game, all fetched with plain downloads:
//   - Poly Pizza: https://static.poly.pizza/<resource>.glb
//   - KayKit packs on GitHub (pinned commits): .gltf + .bin + one shared texture atlas
// Licences: CC0 1.0 unless noted; CC-BY 3.0 entries are credited in CREDITS.md and Settings.

export type Licence = "CC0 1.0" | "CC-BY 3.0";

export interface ModelSource {
  key: string;
  /** Where the file is downloaded from (.glb, or .gltf with sibling resources). */
  url: string;
  /** Human page for credits. */
  page: string;
  title: string;
  author: string;
  licence: Licence;
}

const pp = (
  key: string,
  polyId: string,
  resource: string,
  title: string,
  author = "Quaternius",
  licence: Licence = "CC0 1.0",
): ModelSource => ({
  key,
  url: `https://static.poly.pizza/${resource}.glb`,
  page: `https://poly.pizza/m/${polyId}`,
  title,
  author,
  licence,
});

const KK_HEX =
  "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/84fa4e91af6a88989be7c99e0891cede11f2ca38/addons/kaykit_medieval_hexagon_pack/Assets/gltf";
const KK_HAL =
  "https://media.githubusercontent.com/media/series-ai/jam-ready-assets/ab1b21fe61bc3adeb759c286e770033563f18a97/kaykit-halloween/3D/seasonal-holiday/Assets/gltf";

const kk = (key: string, base: string, path: string, title: string, pack: string): ModelSource => ({
  key,
  url: `${base}/${path}.gltf`,
  page: pack,
  title,
  author: "Kay Lousberg (KayKit)",
  licence: "CC0 1.0",
});
const HEX_PAGE = "https://kaylousberg.itch.io/kaykit-medieval-hexagon";
const HAL_PAGE = "https://kaylousberg.itch.io/halloween-bits";

export const SOURCES: readonly ModelSource[] = [
  // Animals
  pp(
    "animal_hen",
    "8Unya0rw9tR",
    "622d2b3d-e280-48fd-9a82-b0e60443def5",
    "Hen",
    "Poly by Google",
    "CC-BY 3.0",
  ),
  pp(
    "animal_duck",
    "c1fo7hQgC6J",
    "e8d62357-1f2e-440d-ab86-da2aceda4085",
    "Duck",
    "Poly by Google",
    "CC-BY 3.0",
  ),
  pp(
    "animal_goat",
    "bNYS7ETDNCt",
    "401a6a8d-4e8f-460e-8618-84978721df55",
    "Goat",
    "Poly by Google",
    "CC-BY 3.0",
  ),
  pp("animal_sheep", "C39AUXUUes", "a4bd2c4e-fe71-4dbd-9881-cf3ac8a00bbf", "Sheep"),
  pp("animal_pig", "TNvG3QUFlp", "665ee586-6494-4fbd-be46-fcbe600f653e", "Pig"),
  pp("animal_cow", "26zM1outCr", "382b3d4a-a7c9-4c03-9858-3df630d90047", "Cow"),
  pp("animal_donkey", "qmX6nhnvp7", "ca29f94e-0874-41b6-8334-66642af56a61", "Donkey"),
  pp("animal_horse", "qvTrSG9pZF", "d37dbc87-ca61-4b2c-a2da-d2f0c4240bef", "Horse"),
  pp(
    "animal_rabbit",
    "8_ZF1ZGRpk5",
    "3d1a8206-367c-4b31-992d-5d8e18c56a9f",
    "Rabbit",
    "Poly by Google",
    "CC-BY 3.0",
  ),
  pp("animal_llama", "JxVJ9rfWGy", "73641d10-547f-47d8-9c86-ad92158fd78b", "Llama"),
  pp("animal_alpaca", "bCVFD48i2l", "444228bb-745d-49b2-89ef-cc12805deaa8", "Alpaca"),
  pp("animal_bull", "a8PIIYwF7r", "5704ef69-2c27-4de8-a942-70a29458af21", "Bull"),
  pp("farmer", "7pn3R6hPvE", "81f2f0cf-6f53-4b57-92ea-dba0928620f2", "Farmer"),

  // Neighbours
  pp("npc_marigold", "nIItLV9nxS", "46d6db5a-3c9f-4238-8cdf-8eb7194498dc", "Animated Woman"),
  pp("npc_juniper", "qJ2gsTUBHL", "ba7a1955-ea51-4cb9-a561-188bdef0a6c7", "Animated Woman"),
  pp("npc_pip", "Yg2bQZO6Hj", "3a5f3056-ffe6-42eb-bd52-122afcbd22b2", "Worker"),
  pp("npc_barnaby", "kZ3DmIoGip", "90a9e2d4-053f-42f1-99a2-8f5e1180ea7f", "Casual Character"),
  pp("npc_hollis", "ZwF0K7WBmu", "69689495-028d-4b81-8678-792338a5693e", "Adventurer"),

  // Buildings
  pp("building_shed", "aTcDP7UERC", "f8d23d79-6dfd-4667-a961-5b4dad5a32d6", "Small Barn"),
  pp("building_coop", "DM0F8siLam", "3f01eddc-5941-42f5-acb7-363f9db61fd8", "ChickenCoop"),
  pp("building_barn", "vSqQNA7ez6", "e0ecaf1c-bff4-4f30-9a53-0cf0c1c90deb", "Barn"),
  pp("building_stable", "ZIdWHxYsUv", "42b1eade-d1dc-43c8-9769-cfc5ded6c3e6", "Open Barn"),
  kk("building_mill", KK_HEX, "buildings/red/building_windmill_red", "Windmill", HEX_PAGE),
  kk("building_bakery", KK_HEX, "buildings/red/building_home_B_red", "Home B", HEX_PAGE),
  kk("building_press", KK_HEX, "buildings/red/building_tavern_red", "Tavern", HEX_PAGE),
  kk("building_garage", KK_HEX, "buildings/red/building_blacksmith_red", "Blacksmith", HEX_PAGE),

  // Vehicles
  kk("vehicle_tractor", KK_HAL, "tractor", "Tractor", HAL_PAGE),
  kk("vehicle_wagon", KK_HAL, "wagon", "Wagon", HAL_PAGE),
  kk("vehicle_wagon_hay", KK_HAL, "wagon_hay", "Hay Wagon", HAL_PAGE),

  // Decorations
  pp("decor_fence", "e02PFKKhbr", "ee42b0f4-fbcd-425f-804e-02d791bc35f6", "Fence"),
  pp("decor_bench", "jLxjFxFRpw", "1361c268-20f7-4e73-a931-ce434c6b503e", "Bench"),
  pp("decor_barrel", "ONdghDBByN", "6d3e8847-bda4-4d6c-8004-7b03cf848b13", "Barrel"),
  pp("decor_well", "QlqncKYxXb", "0e044203-f62e-4dad-ad3e-c3cb6cb393ac", "Well"),
  pp("decor_windmill", "WUbU1Nct2W", "6bf79810-ea32-4451-84e9-221e69020a40", "Windmill"),
  pp("decor_hay", "Yu8TOERkpw", "8ab0043c-9a54-47b1-9b46-31b98d2f6ed8", "Hay"),
  pp(
    "decor_stones",
    "UQ7Om3xGn3",
    "7ab1bb13-2c61-457c-80c7-58713241dfdc",
    "Cobble Stones",
    "Isa Lousberg",
  ),
  pp(
    "decor_lantern",
    "ZSQ65S4lEu",
    "41095798-4ff6-4567-8654-026703a51f32",
    "Post Lantern",
    "Kay Lousberg",
  ),
  pp(
    "decor_fountain",
    "WHc7dwttlk",
    "45b4ed51-5391-4d9b-8788-726eb883fb9a",
    "Fountain",
    "Isa Lousberg",
  ),
  pp("decor_gazebo", "xYZB1TmGMv", "a0c33317-3662-478e-b826-78590c348d83", "Gazebo"),
  kk("decor_scarecrow", KK_HAL, "scarecrow", "Scarecrow", HAL_PAGE),
  pp("decor_bridge", "j4KsIuJYnq", "e36966b4-e13e-46e8-aa2c-f9b643536d46", "Small Bridge"),
  pp("decor_horse_statue", "AK9CmjFnL6", "55b0aa03-543c-439d-a7d7-f0ac4c23578f", "Horse Statue"),
  pp("decor_market_stall", "DGIM5HGISb", "e2633001-4cf5-46fa-ac68-575c9954f4ba", "Market Stand"),
  pp("decor_cottage", "oJJIRwv6Bo", "65d155f6-705c-4e6c-9e3a-b9974bb82324", "House"),
  kk("decor_haybale", KK_HAL, "haybale", "Hay Bale", HAL_PAGE),

  // Scenery around the farm
  pp("scenery_silo", "5GhLrv5Ce3", "3944662c-ccdd-440d-94bf-a1e37624a536", "Silo"),
  pp(
    "scenery_tree_round",
    "Ufuhx2aA2Y",
    "6f205fab-f5c0-4bd8-a749-91c5d64044e3",
    "Tree",
    "Isa Lousberg",
  ),
  pp(
    "scenery_tree_tall",
    "YgiDjl5MVp",
    "bc06260a-9d08-4b99-9d73-280d92276f0b",
    "Tree Large",
    "Isa Lousberg",
  ),
  pp(
    "scenery_pine",
    "7QrrpRCYXd",
    "a8d9678e-38f7-482a-8627-418f85374c3e",
    "Tree Large",
    "Isa Lousberg",
  ),
  pp(
    "scenery_pine_autumn",
    "UopgJkSuo9",
    "93123e4c-7c31-4c9c-89dd-b0dda08a0a53",
    "Autumn pine",
    "Kay Lousberg",
  ),
  pp("scenery_bush", "I5KhMKZKju", "395da3ee-c61f-4a7d-b9ed-eb2052c8e86b", "Bush", "Isa Lousberg"),
  pp(
    "scenery_bush_large",
    "VKKkva9Whj",
    "72aa0d4e-90a5-41f8-b995-9264bd113ab8",
    "Bush Large",
    "Isa Lousberg",
  ),
  pp("scenery_rock", "4vHWF8XUBn", "1bb4bee6-0673-483d-bcdd-74dc64f1f3c8", "Rock"),
  pp("scenery_rock_small", "cBqdRdLDDL", "ca41577b-34b7-47b2-b2e3-5ca4c46eb430", "Rock", "Kenney"),
  pp(
    "scenery_flower",
    "DG7oCt9QYv",
    "39beaee6-f5fd-4e86-b587-f8600767c724",
    "Flower A",
    "Isa Lousberg",
  ),
  pp("scenery_mushroom", "db1tjMhmiA", "c30dcc3b-c43d-4ce8-9b2d-6dd942b81fd7", "Mushroom"),
  pp("scenery_stump", "nFvEbUX6LE", "f6caf11a-75ff-4a6e-9d87-28b44f685803", "Tree Stump with Moss"),
  pp("scenery_log", "L4E32Wee6C", "89d5c7b9-0735-4640-913d-87261dfecd32", "Wood Log"),
];

export const RAW_DIR = "raw-assets/models";
export const OUT_DIR = "public/models";

/** Local path of a downloaded source: `<key>.glb`, or `<key>/<name>.gltf` with its resources. */
export function rawPath(source: ModelSource): string {
  if (source.url.endsWith(".glb")) return `${RAW_DIR}/${source.key}.glb`;
  const name = source.url.split("/").at(-1) ?? `${source.key}.gltf`;
  return `${RAW_DIR}/${source.key}/${name}`;
}
