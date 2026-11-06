"use client";

import { Toaster } from "@/components/ui/sonner";
import { useUi } from "@/game/store/uiStore";
import { BuildingDialog } from "./BuildingDialog";
import { FarmBook } from "./book/FarmBook";
import { FloatLayer } from "./FloatLayer";
import { FlyLayer } from "./FlyLayer";
import { LevelUpModal } from "./LevelUpModal";
import { MarketDialog } from "./market/MarketDialog";
import { Celebrations } from "./notify/Celebrations";
import { QuestDialog } from "./quests/QuestDialog";
import { QuestRail } from "./quests/QuestRail";
import { SeedPicker } from "./SeedPicker";
import { SettingsDialog } from "./SettingsDialog";
import { StorageDialog } from "./StorageDialog";
import { CloudWipe } from "./social/CloudWipe";
import { DailyDialog } from "./social/DailyDialog";
import { EventDialog } from "./social/EventDialog";
import { NeighborsDialog } from "./social/NeighborsDialog";
import { RightRail } from "./social/RightRail";
import { VisitBar } from "./social/VisitBar";
import { Toolbar } from "./Toolbar";
import { Tooltip } from "./Tooltip";
import { TopBar } from "./TopBar";
import { Tutorial } from "./tutorial/Tutorial";
import { useGameSignals } from "./useGameSignals";

/** DOM overlay above the canvas. Only its panels take pointer events. */
export function Hud() {
  useGameSignals();
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-10 select-none">
        <FloatLayer />
        <TopBar />
        <QuestRail />
        <RightRail />
        <VisitBar />
        <Toolbar />
      </div>
      <FlyLayer />
      <Tooltip />
      <Announcer />
      <SeedPicker />
      <MarketDialog />
      <StorageDialog />
      <BuildingDialog />
      <SettingsDialog />
      <FarmBook />
      <QuestDialog />
      <DailyDialog />
      <EventDialog />
      <NeighborsDialog />
      <CloudWipe />
      <Celebrations />
      <Tutorial />
      <LevelUpModal />
      <Toaster position="top-center" offset={88} />
    </>
  );
}

/** Screen-reader announcements (keyboard cursor, what's under it). */
function Announcer() {
  const text = useUi((s) => s.announce);
  return (
    <div aria-live="polite" className="sr-only" data-testid="announcer">
      {text}
    </div>
  );
}
