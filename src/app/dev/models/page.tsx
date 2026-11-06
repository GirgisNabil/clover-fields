import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModelGalleryShell } from "./gallery-shell";

export const metadata: Metadata = { title: "Model gallery", robots: { index: false } };

export default function ModelGalleryPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_E2E !== "1") notFound();
  return <ModelGalleryShell />;
}
