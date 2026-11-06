import { notFound } from "next/navigation";
import { ModelGalleryShell } from "./gallery-shell";

export default function ModelGalleryPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_E2E !== "1") notFound();
  return <ModelGalleryShell />;
}
