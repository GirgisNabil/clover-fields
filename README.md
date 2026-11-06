# 🍀 Clover Fields

An isometric farming game for the browser: plow, plant and harvest crops, raise animals,
grow fruit trees, decorate, and expand your land. Built with Next.js, React Three Fiber and
a pure, tested game engine.

## Play

```bash
npm install
npm run dev        # http://localhost:3000
```

Your farm saves automatically in the browser (IndexedDB). Settings (⚙️) has export/import
and "start a new farm".

### Controls

|                                |                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **1** Farm tool                | Click or drag across ripe crops to harvest, plowed soil to plant, grass to plow                            |
| **2** Plow                     | Click or drag over grass                                                                                   |
| **3** Seeds                    | Pick a crop to plant                                                                                       |
| **4** Market                   | Buy seeds, animals, trees, buildings, decorations, specials and land                                       |
| **5** Arrange                  | Pick something up and put it somewhere else (R rotates; drop animals on a matching building to house them) |
| **6** Sell                     | Sell an item or remove a plot                                                                              |
| **7** Shed                     | Your Tool Shed storage                                                                                     |
| Drag empty ground / right-drag | Pan · wheel or pinch to zoom · WASD/arrows also pan                                                        |
| Esc                            | Cancel placing, back to the Farm tool, or stop the farmer's queue                                          |

Your farmer walks to every job you queue. Crops planted before level 6 never wither.

## Development

```bash
npm run check      # Biome lint + TypeScript + Vitest unit tests
npm run e2e        # Production build + Playwright tests in Chrome
```

Dev-only pages: `/dev/crops` (every crop at every growth stage) and `/dev/models` (every 3D model).
In development, `window.__clover` exposes test hooks, e.g. `__clover.clock.advance(3600000)` to skip an hour.

### Layout

- `src/domain/` — the pure game engine: catalog and balance, rules, `applyCommand`, the farmer's
  queue projection, save format. No React, no clocks, no randomness inside: same input, same output,
  so it can run on a server later.
- `src/game/` — stores, persistence, camera and input, the 3D scene (instanced crops, models, farmer).
- `src/hud/` — the DOM interface on top of the canvas.
- `scripts/assets/` — fetches and optimizes the CC0 3D models (`npm run assets:fetch && npm run assets:build`).

## Credits

3D animals, farmer, buildings and scenery: Quaternius (CC0), via Poly Pizza — see
`public/licenses/CREDITS.md`. Crops, fruit trees and soil are procedural models made for this game.
Sound effects are synthesized in the browser.
