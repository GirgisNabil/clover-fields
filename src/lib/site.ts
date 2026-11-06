// Where the site lives. Set at build time for deploys (e.g. GitHub Pages serves the project
// under /<repo>), so links, icons and model files resolve correctly.

/** Path prefix for every URL ("" locally, "/clover-fields" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The public origin, used for absolute social-share URLs. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const withBasePath = (path: string) => `${BASE_PATH}${path}`;
