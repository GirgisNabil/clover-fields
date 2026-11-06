import type { NextConfig } from "next";

// `NEXT_OUTPUT=export` builds a static site into out/ (GitHub Pages); NEXT_PUBLIC_BASE_PATH
// serves it under a sub-path such as /clover-fields.
const staticExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath } : {}),
  // Partial prerendering can't run in a static export; the game is client-rendered anyway.
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
