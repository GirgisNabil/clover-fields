import { resolve } from "node:path";
import base from "../../playwright.config";

// Same server and browser as the e2e suite, but only the brand image generators.
export default {
  ...base,
  testDir: ".",
  testMatch: "og.spec.ts",
  webServer: { ...(base.webServer as object), cwd: resolve(__dirname, "../..") },
};
