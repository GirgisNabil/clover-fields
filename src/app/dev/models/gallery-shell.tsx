"use client";

import dynamic from "next/dynamic";

const ModelGallery = dynamic(() => import("@/game/dev/ModelGallery").then((m) => m.ModelGallery), {
  ssr: false,
});

export function ModelGalleryShell() {
  return <ModelGallery />;
}
