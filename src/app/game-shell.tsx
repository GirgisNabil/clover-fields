"use client";

import dynamic from "next/dynamic";
import { Logo } from "@/components/brand/Logo";

// The game touches WebGL and window, so it only ever renders in the browser.
const GameRoot = dynamic(() => import("@/game/GameRoot").then((m) => m.GameRoot), {
  ssr: false,
  loading: () => <Splash />,
});

export function GameShell() {
  return <GameRoot />;
}

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-sky">
      <Logo size={64} textClassName="text-4xl" />
    </div>
  );
}
