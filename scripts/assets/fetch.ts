// Downloads the source models listed in sources.ts and plants.ts into raw-assets/ (gitignored).
// Usage: npm run assets:fetch

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PLANT_RAW_DIR } from "./bakePlants.ts";
import { PLANT_PACKS, plantUrl } from "./plants.ts";
import { rawPath, SOURCES } from "./sources.ts";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url: string, file: string): Promise<Uint8Array | null> {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`✗ HTTP ${response.status} for ${url}`);
    process.exitCode = 1;
    return null;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  await pause(200); // Be gentle with the hosts.
  return bytes;
}

for (const source of SOURCES) {
  const file = rawPath(source);
  if (existsSync(file)) continue;
  const bytes = await download(source.url, file);
  if (!bytes) continue;
  if (file.endsWith(".gltf")) {
    // Fetch the .bin buffers and textures the .gltf refers to, next to it.
    const json = JSON.parse(new TextDecoder().decode(bytes)) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
    };
    const base = source.url.slice(0, source.url.lastIndexOf("/") + 1);
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
      .map((entry) => entry.uri)
      .filter((uri): uri is string => !!uri && !uri.startsWith("data:"));
    for (const uri of uris) {
      const local = join(dirname(file), decodeURIComponent(uri));
      if (!existsSync(local)) await download(new URL(uri, base).href, local);
    }
  }
  console.log(`↓ ${source.key}`);
}

mkdirSync(PLANT_RAW_DIR, { recursive: true });
for (const pack of PLANT_PACKS) {
  for (const name of pack.files) {
    const file = join(PLANT_RAW_DIR, `${name}.glb`);
    if (existsSync(file)) continue;
    if (await download(plantUrl(pack, name), file)) console.log(`↓ plant ${name}`);
  }
}
