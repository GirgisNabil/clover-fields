import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { SITE_URL, withBasePath } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const TITLE = "Clover Fields: a cozy farming game";
const DESCRIPTION =
  "Plow, plant and harvest your way to the farm of your dreams. Raise roaming animals, craft goods, help your neighbours and celebrate the seasons in a cozy 3D farm you play right in your browser.";

export const metadata: Metadata = {
  // Next adds the base path to metadata files itself, so only the origin goes here.
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Clover Fields" },
  description: DESCRIPTION,
  applicationName: "Clover Fields",
  // A static file with relative URLs, so it works under any base path (GitHub Pages too).
  manifest: withBasePath("/manifest.webmanifest"),
  keywords: ["farming game", "farm", "cozy game", "browser game", "3D", "crops", "animals"],
  category: "games",
  creator: "Girgis Nabil",
  openGraph: {
    type: "website",
    siteName: "Clover Fields",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  appleWebApp: { capable: true, title: "Clover Fields", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#4cb92c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
