// `window.__clover` gives e2e tests and the dev console a handle on the running game.
// It exists in development and in E2E builds only; production builds drop it.

export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

export interface CloverHooks {
  /** True once the first frames have rendered. */
  ready: boolean;
  [name: string]: unknown;
}

declare global {
  interface Window {
    __clover?: CloverHooks;
  }
}

export function installTestHooks(hooks: Partial<CloverHooks>): void {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return;
  window.__clover = Object.assign(window.__clover ?? { ready: false }, hooks);
}
