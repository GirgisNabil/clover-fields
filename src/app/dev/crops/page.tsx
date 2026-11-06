import { notFound } from "next/navigation";
import { CropGalleryShell } from "./gallery-shell";

export default function CropGalleryPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_E2E !== "1") notFound();
  return <CropGalleryShell />;
}
