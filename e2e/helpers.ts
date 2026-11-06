import { expect, type Page } from "@playwright/test";
import type { FarmState, FieldCommand, InstantCommand, QueueEntry } from "../src/domain";
import type { IsoView } from "../src/game/math/iso";

/** The dev/e2e test hooks the game installs on window.__clover. */
export interface Hooks {
  ready: boolean;
  getFarm(): FarmState;
  getQueue(): QueueEntry[];
  enqueue(cmd: FieldCommand): unknown;
  dispatch(cmd: InstantCommand): unknown;
  flushQueue(): void;
  tileToScreen(x: number, y: number): { x: number; y: number };
  worldToScreen(x: number, y: number, z: number): { x: number; y: number };
  groundTileAt(px: number, py: number): { x: number; y: number };
  clock: { now(): number; advance(ms: number): void; freeze(): void };
  setTool(tool: "hand" | "plow" | "seed"): void;
  camera(): IsoView;
  setCamera(view: Partial<IsoView>): void;
  setFarmerPaused(paused: boolean): void;
  visit(): { npcId: string; targets: Array<{ x: number; y: number; kind: string }> } | null;
  animals(): Array<{
    id: string;
    defId: string;
    tile: { x: number; y: number };
    home: { x: number; y: number };
    housed: boolean;
    resting: boolean;
    roams: boolean;
    live: { x: number; z: number; height: number; visible: boolean } | null;
  }>;
}

/** Opens a fresh farm. The farmer is paused unless asked, so tests can step the queue themselves. */
export async function openFarm(
  page: Page,
  {
    farmerWorks = false,
    quality = "low",
    tutorial = false,
  }: { farmerWorks?: boolean; quality?: "low" | "high"; tutorial?: boolean } = {},
) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  // The software GPU in CI is slow; most tests don't need ambient occlusion.
  // Coach marks are off unless a test is about the tutorial.
  await page.addInitScript(
    ({ q, coach }) => {
      localStorage.setItem("cf:quality", q);
      if (coach) localStorage.removeItem("cf:tutorial-off");
      else localStorage.setItem("cf:tutorial-off", "1");
    },
    { q: quality, coach: tutorial },
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__clover?.ready === true);
  if (!farmerWorks) await game(page, (h) => h.setFarmerPaused(true));
  return errors;
}

/** Runs a function against the game's hooks inside the page. */
export function game<T, A = undefined>(page: Page, fn: (hooks: Hooks, arg: A) => T, arg?: A) {
  return page.evaluate(
    ({ source, arg: input }) => {
      // Rebuild the test's callback inside the page, then call it with the game hooks.
      const run = new Function(`return (${source})`)() as (hooks: unknown, arg: unknown) => T;
      return run(window.__clover, input);
    },
    { source: fn.toString(), arg },
  ) as Promise<T>;
}

export async function tile(page: Page, x: number, y: number) {
  return game(page, (h, at: { x: number; y: number }) => h.tileToScreen(at.x, at.y), { x, y });
}

/** Presses on one tile and drags across to another, like painting with the mouse. */
export async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await tile(page, ...from);
  const b = await tile(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

export async function click(page: Page, x: number, y: number) {
  const p = await tile(page, x, y);
  await page.mouse.click(p.x, p.y);
}

export async function coins(page: Page) {
  return game(page, (h) => h.getFarm().wallet.coins);
}

export async function queueLength(page: Page) {
  return game(page, (h) => h.getQueue().length);
}

export async function expectNoErrors(errors: string[]) {
  expect(errors).toEqual([]);
}
