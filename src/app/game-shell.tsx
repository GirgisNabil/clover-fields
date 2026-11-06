"use client";

import dynamic from "next/dynamic";

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
      <p className="font-display text-4xl font-semibold text-white drop-shadow-[0_3px_0_#3d8a24]">
        🍀 Clover Fields
      </p>
    </div>
  );
}
