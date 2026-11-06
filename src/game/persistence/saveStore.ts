import { createStore, del, get, set } from "idb-keyval";
import {
  createFarm,
  type FarmState,
  type LoadResult,
  loadEnvelope,
  makeEnvelope,
  type SaveEnvelope,
} from "@/domain";

const MAIN = "save:main";
const PREV = "save:prev";
const EMERGENCY = "cf:emergency";

let store: ReturnType<typeof createStore> | null = null;
const db = () => {
  store ??= createStore("clover-fields", "kv");
  return store;
};

function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

function readEmergency(): unknown {
  try {
    const raw = localStorage.getItem(EMERGENCY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export interface Loaded {
  farm: FarmState;
  rev: number;
  isNew: boolean;
  notes: string[];
}

/** Loads the newest valid save (main, previous or emergency copy), or starts a new farm. */
export async function loadOrCreateFarm(now: number): Promise<Loaded> {
  const candidates: unknown[] = [];
  try {
    candidates.push(await get(MAIN, db()), await get(PREV, db()));
  } catch {
    // IndexedDB unavailable (private mode, blocked storage): fall through to the emergency copy.
  }
  candidates.push(readEmergency());

  let best: Extract<LoadResult, { ok: true }> | null = null;
  for (const raw of candidates) {
    if (!raw) continue;
    const result = loadEnvelope(raw);
    if (result.ok && (!best || result.rev > best.rev)) best = result;
    if (!result.ok && result.reason === "invalid") {
      try {
        await set(`save:corrupt:${now}`, raw, db());
      } catch {
        // Nothing more we can do with a broken save.
      }
    }
  }
  if (best) return { farm: best.state, rev: best.rev, isNew: false, notes: best.notes };

  const farm = createFarm({
    farmId: crypto.randomUUID(),
    seed: randomUint32(),
    salt: randomUint32(),
    now,
  });
  return { farm, rev: 0, isNew: true, notes: [] };
}

/** Writes the save, keeping the previous one as a fallback. */
export async function writeSave(farm: FarmState, rev: number, now: number): Promise<void> {
  const envelope = makeEnvelope(farm, rev, now);
  const store = db();
  const previous = await get<SaveEnvelope>(MAIN, store);
  if (previous && previous.rev !== rev) await set(PREV, previous, store);
  await set(MAIN, envelope, store);
}

/** Synchronous last-chance copy for page unloads, when async writes may not finish. */
export function writeEmergencyCopy(farm: FarmState, rev: number, now: number) {
  try {
    localStorage.setItem(EMERGENCY, JSON.stringify(makeEnvelope(farm, rev, now)));
  } catch {
    // Storage full or blocked; the IndexedDB save is still there.
  }
}

export async function wipeSaves(): Promise<void> {
  const store = db();
  await Promise.all([del(MAIN, store), del(PREV, store)]);
  try {
    localStorage.removeItem(EMERGENCY);
  } catch {
    // ignore
  }
}
