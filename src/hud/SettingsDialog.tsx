"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useVolumes, type Volumes } from "@/audio/engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { loadEnvelope, makeEnvelope } from "@/domain";
import { clock } from "@/game/clock";
import { farmer } from "@/game/farmer/FarmerController";
import { saveNow } from "@/game/persistence/autosave";
import { loadOrCreateFarm, wipeSaves } from "@/game/persistence/saveStore";
import { useGraphics } from "@/game/quality/graphicsStore";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";

const VOLUME_ROWS: Array<[keyof Volumes, string]> = [
  ["master", "🔊 Volume"],
  ["music", "🎵 Music"],
  ["sfx", "🔔 Sound effects"],
  ["ambient", "🐦 Birds & wind"],
];

const UI_SCALES = [
  [0.9, "Small"],
  [1, "Normal"],
  [1.15, "Large"],
  [1.3, "Huge"],
] as const;
const SCALE_KEY = "cf:ui-scale";

/** Scales every HUD size (Tailwind sizes are in rem). */
export function applyUiScale(scale: number) {
  document.documentElement.style.fontSize = `${16 * scale}px`;
}

export function readUiScale(): number {
  try {
    const v = Number(localStorage.getItem(SCALE_KEY));
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}

const button =
  "rounded-full bg-wheat px-4 py-2 font-display font-semibold text-ink shadow-press-sm hover:bg-[#f7ead0]";

export function SettingsDialog() {
  const open = useUi((s) => s.dialog === "settings");
  const openDialog = useUi((s) => s.openDialog);
  const volumes = useVolumes();
  const [uiScale, setUiScale] = useState(1);
  const quality = useGraphics((s) => s.quality);
  const setQuality = useGraphics((s) => s.setQuality);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setUiScale(readUiScale()), []);

  const chooseScale = (scale: number) => {
    setUiScale(scale);
    applyUiScale(scale);
    try {
      localStorage.setItem(SCALE_KEY, String(scale));
    } catch {
      // Not persisted.
    }
  };

  const exportSave = () => {
    const { farm, rev } = useGame.getState();
    const blob = new Blob([JSON.stringify(makeEnvelope(farm, rev, clock.now()), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clover-fields-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSave = async (file: File) => {
    try {
      const result = loadEnvelope(JSON.parse(await file.text()));
      if (!result.ok) {
        toast(
          result.reason === "too-new"
            ? "That save is from a newer version."
            : "That isn't a Clover Fields save.",
        );
        return;
      }
      useGame.getState().hydrate(result.state, Math.max(result.rev, useGame.getState().rev) + 1);
      farmer.placeAt(result.state.land.size / 2, result.state.land.size / 2 + 2);
      await saveNow();
      toast.success("Farm loaded! 🍀");
      openDialog(null);
    } catch {
      toast("Couldn't read that file.");
    }
  };

  const reset = async () => {
    await wipeSaves();
    const fresh = await loadOrCreateFarm(clock.now());
    useGame.getState().hydrate(fresh.farm, 0);
    farmer.placeAt(6.5, 8.5);
    await saveNow();
    setConfirmReset(false);
    openDialog(null);
    toast.success("A brand new farm! 🌱");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        openDialog(next ? "settings" : null);
        if (!next) setConfirmReset(false);
      }}
    >
      <DialogContent className="border-4 border-wood bg-cream sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Settings</DialogTitle>
          <DialogDescription>Your farm saves automatically in this browser.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 rounded-xl bg-white px-4 py-3 font-display text-ink">
          {VOLUME_ROWS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0">{label}</span>
              <Slider
                aria-label={label}
                value={[Math.round(volumes[key] * 100)]}
                max={100}
                step={5}
                onValueChange={([v]) => volumes.set(key, (v ?? 0) / 100)}
              />
            </div>
          ))}
        </div>
        <fieldset className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 font-display text-ink">
          <legend className="sr-only">Interface size</legend>
          <span aria-hidden>🔎 Interface size</span>
          <div className="flex gap-1">
            {UI_SCALES.map(([scale, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={uiScale === scale}
                onClick={() => chooseScale(scale)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${uiScale === scale ? "bg-sun text-ink" : "bg-wheat text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 font-display text-ink">
          <span id="quality-setting">
            ✨ High-quality graphics
            <span className="block font-sans text-xs text-muted-foreground">
              Soft shading, color grading and more grass. Turn off if the game feels slow.
            </span>
          </span>
          <Switch
            aria-labelledby="quality-setting"
            checked={quality === "high"}
            onCheckedChange={(on) => setQuality(on ? "high" : "low")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={exportSave}>
            ⬇️ Export save
          </button>
          <button type="button" className={button} onClick={() => fileInput.current?.click()}>
            ⬆️ Import save
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSave(file);
              event.target.value = "";
            }}
          />
        </div>
        <div className="rounded-xl border-2 border-dashed border-berry/40 p-3">
          {confirmReset ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink">This deletes your farm for good. Start over?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-berry px-4 py-2 font-display font-semibold text-white"
                  onClick={() => void reset()}
                >
                  Yes, start over
                </button>
                <button type="button" className={button} onClick={() => setConfirmReset(false)}>
                  Keep my farm
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="font-display text-sm font-semibold text-berry"
              onClick={() => setConfirmReset(true)}
            >
              Start a new farm…
            </button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          3D models by Quaternius, Kay &amp; Isa Lousberg (CC0) and Poly by Google (CC-BY 3.0) ·{" "}
          <a className="underline" href="/licenses/CREDITS.md" target="_blank" rel="noreferrer">
            credits
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
