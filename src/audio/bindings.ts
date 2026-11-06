import { activeEvent, isRestTime } from "@/domain";
import { clock } from "@/game/clock";
import { gameBus } from "@/game/store/eventBus";
import { useGame } from "@/game/store/gameStore";
import { setNight, startAmbient } from "./ambient";
import { duckMusic } from "./engine";
import { setMusicMood, startMusic } from "./music";
import { sfx, unlockAudio } from "./sfx";

/** Plays sounds for game events. Returns a stop function. */
export function startAudio(): () => void {
  const unlock = () => unlockAudio();
  const stopMusic = startMusic();
  const stopAmbient = startAmbient();
  // Music follows where you are (home, visiting) and the season; ambience follows the time of day.
  const moodTimer = setInterval(() => {
    const { visit, farm } = useGame.getState();
    const now = clock.now();
    setMusicMood(visit ? "visit" : (activeEvent(now)?.def.mood ?? "farm"));
    setNight(isRestTime(now, farm.meta.dayOffsetMin));
  }, 1000);
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  const off = gameBus.on((signal) => {
    if (signal.type === "rejected" || signal.type === "refused") {
      sfx.error();
      return;
    }
    if (signal.type !== "events") return;
    for (const event of signal.events) {
      switch (event.t) {
        case "plowed":
          sfx.plow();
          break;
        case "planted":
          sfx.plant();
          break;
        case "harvested":
          sfx.collect();
          sfx.coin();
          break;
        case "placed":
        case "moved":
          sfx.place();
          break;
        case "removed":
          if (event.to === "sold") sfx.coin();
          else sfx.place();
          break;
        case "craftStarted":
          sfx.place();
          break;
        case "crafted":
          sfx.collect();
          break;
        case "vehiclePass":
          sfx.engine();
          break;
        case "levelUp":
          duckMusic();
          sfx.levelUp();
          break;
        case "masteryStar":
          sfx.star();
          break;
      }
    }
  });
  return () => {
    off();
    stopMusic();
    stopAmbient();
    clearInterval(moodTimer);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}
