import { cn } from "cn";
import { getNpc } from "@/domain";

/** A neighbour's face in a ring of their color, with an optional progress arc. */
export function Portrait({
  npc,
  size = 48,
  progress,
  className,
}: {
  npc: string;
  size?: number;
  progress?: number;
  className?: string;
}) {
  const def = getNpc(npc);
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full bg-cream", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efe6d4" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={def?.color ?? "#4cb92c"}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${c * (progress ?? 1)} ${c}`}
        />
      </svg>
      <span style={{ fontSize: size * 0.5 }} className="leading-none">
        {def?.icon ?? "🙂"}
      </span>
    </span>
  );
}

export function RewardChips({
  reward,
}: {
  reward: {
    coins?: number;
    xp?: number;
    clovers?: number;
    materials?: Readonly<Record<string, number>>;
  };
}) {
  return (
    <span className="flex flex-wrap gap-1.5 text-xs font-semibold text-ink">
      {reward.coins ? (
        <span className="rounded-full bg-wheat px-2 py-0.5">
          🪙 {reward.coins.toLocaleString()}
        </span>
      ) : null}
      {reward.xp ? <span className="rounded-full bg-wheat px-2 py-0.5">⭐ {reward.xp}</span> : null}
      {reward.clovers ? (
        <span className="rounded-full bg-wheat px-2 py-0.5">🍀 {reward.clovers}</span>
      ) : null}
      {Object.keys(reward.materials ?? {}).length ? (
        <span className="rounded-full bg-wheat px-2 py-0.5">⚙️ bonus</span>
      ) : null}
    </span>
  );
}
