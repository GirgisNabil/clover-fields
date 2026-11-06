import { clock } from "../clock";
import { useGame } from "../store/gameStore";
import { useSaveStatus } from "./saveStatus";
import { writeEmergencyCopy, writeSave } from "./saveStore";

const DEBOUNCE_MS = 2_000;
const MAX_WAIT_MS = 15_000;

/** Saves after changes settle (or at least every 15 s) and on tab hide / unload. Returns a stop function. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let savedRev = useGame.getState().rev;
  let writing = false;

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    firstDirtyAt = null;
    const { farm, rev, status } = useGame.getState();
    if (status !== "ready" || rev === savedRev || writing) return;
    writing = true;
    try {
      await writeSave(farm, rev, clock.now());
      savedRev = rev;
      if (useSaveStatus.getState().failed) useSaveStatus.setState({ failed: false });
    } catch (error) {
      console.warn("Autosave failed", error);
      useSaveStatus.setState({ failed: true, retry: () => void flush() });
    } finally {
      writing = false;
    }
  };

  const schedule = () => {
    const now = Date.now();
    firstDirtyAt ??= now;
    if (timer) clearTimeout(timer);
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, firstDirtyAt + MAX_WAIT_MS - now));
    timer = setTimeout(() => void flush(), wait);
  };

  const unsubscribe = useGame.subscribe((s) => s.rev, schedule);

  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  const onPageHide = () => {
    const { farm, rev, status } = useGame.getState();
    if (status === "ready") writeEmergencyCopy(farm, rev, clock.now());
    void flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
    void flush();
  };
}

/** Saves right away (used after creating a new farm). */
export async function saveNow() {
  const { farm, rev } = useGame.getState();
  await writeSave(farm, rev, clock.now());
}
