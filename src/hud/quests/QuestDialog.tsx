"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeError, getNpc, type QuestStepView, questsView } from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { Portrait, RewardChips } from "./Portrait";

/** A neighbour's quest card: what they ask, how far along you are, and the reward. */
export function QuestDialog() {
  const open = useUi((s) => s.dialog === "quest");
  const npcId = useUi((s) => s.questNpc);
  const openDialog = useUi((s) => s.openDialog);
  const farm = useGame((s) => s.farm);
  const npc = npcId ? getNpc(npcId) : undefined;
  if (!npc) return null;
  const quests = questsView(farm).filter((q) => q.npc === npc.id);
  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "quest" : null)}>
      <DialogContent className="border-4 border-wood bg-cream sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <Portrait npc={npc.id} size={64} />
          <div>
            <DialogTitle className="font-display text-xl">{npc.name}</DialogTitle>
            <DialogDescription>{npc.role}</DialogDescription>
          </div>
        </DialogHeader>
        {quests.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing right now. Check back as your farm grows!
          </p>
        ) : (
          quests.map((q) => <QuestCard key={q.lineId} quest={q} />)
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuestCard({ quest }: { quest: QuestStepView }) {
  const claim = () => {
    const error = useGame.getState().dispatch({ type: "claimQuest", lineId: quest.lineId });
    if (error) toast(describeError(error));
  };
  return (
    <section
      data-testid={`quest-${quest.lineId}`}
      className="flex flex-col gap-2 rounded-2xl bg-white p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-semibold text-ink">{quest.title}</span>
        <span className="text-[11px] text-muted-foreground">
          {quest.lineName} · {quest.step + 1}/{quest.steps}
        </span>
      </div>
      <p className="rounded-xl bg-[#fff6e0] px-3 py-2 text-sm text-ink">“{quest.text}”</p>
      <ul className="flex flex-col gap-1.5">
        {quest.goals.map((g) => (
          <li key={g.label} className="flex flex-col gap-0.5 text-sm">
            <span className="flex justify-between text-ink">
              <span>
                {g.done ? "✅" : "▫️"} {g.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {g.have.toLocaleString()}/{g.need.toLocaleString()}
              </span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-wheat">
              <span
                className="block h-full rounded-full bg-leaf"
                style={{ width: `${(g.have / g.need) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <RewardChips reward={quest.reward} />
        {quest.auto ? (
          <span className="text-xs text-muted-foreground">Rewards arrive automatically</span>
        ) : (
          <button
            type="button"
            disabled={!quest.complete}
            onClick={claim}
            className="rounded-full bg-grass px-4 py-1.5 font-display text-sm font-semibold text-white shadow-press-sm disabled:bg-wheat disabled:text-muted-foreground disabled:shadow-none"
          >
            {quest.complete ? "Claim reward" : "In progress"}
          </button>
        )}
      </div>
    </section>
  );
}
