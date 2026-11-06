import { create } from "zustand";

/** Whether the last autosave failed (storage full, blocked or private mode). */
export const useSaveStatus = create<{ failed: boolean; retry: (() => void) | null }>(() => ({
  failed: false,
  retry: null,
}));
