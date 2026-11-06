"use client";

import dynamic from "next/dynamic";

const CropGallery = dynamic(() => import("@/game/dev/CropGallery").then((m) => m.CropGallery), {
  ssr: false,
});

export function CropGalleryShell() {
  return <CropGallery />;
}
