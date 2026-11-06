"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import type { Price } from "@/domain";

export function PriceTag({ price, short }: { price: Price | null; short?: boolean }) {
  if (!price) return <>Free</>;
  return "coins" in price ? (
    <>🪙 {price.coins.toLocaleString()}</>
  ) : (
    <>
      🍀 {price.clovers}
      {short ? "" : " GC"}
    </>
  );
}

export function ItemCard({
  icon,
  name,
  lines,
  price,
  lockedAt,
  poor,
  selected,
  footer,
  onClick,
}: {
  icon: string;
  name: string;
  lines: ReactNode[];
  price: Price | null;
  lockedAt?: number | undefined;
  poor?: boolean;
  selected?: boolean;
  footer?: ReactNode;
  onClick?: () => void;
}) {
  const locked = lockedAt !== undefined;
  const className = cn(
    "relative flex flex-col items-center gap-1 rounded-2xl border-4 bg-white p-3 text-center transition-transform",
    selected ? "border-leaf bg-[#f1fbe9]" : "border-wheat",
    onClick && !locked && "hover:-translate-y-0.5 hover:border-sun",
    locked && "cursor-not-allowed opacity-55 grayscale",
  );
  const body = (
    <>
      <span className="text-4xl leading-none">{icon}</span>
      <span className="font-display text-sm font-semibold leading-tight text-ink">{name}</span>
      {lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static detail lines
        <span key={i} className="text-xs text-muted-foreground">
          {line}
        </span>
      ))}
      {footer ?? (
        <span
          className={cn(
            "mt-auto rounded-full px-3 py-0.5 font-display text-sm font-semibold",
            locked
              ? "bg-wheat text-ink"
              : poor
                ? "bg-[#fde2df] text-berry"
                : "bg-[#fff1cf] text-ink",
          )}
        >
          {locked ? `🔒 Level ${lockedAt}` : <PriceTag price={price} />}
        </span>
      )}
    </>
  );
  // Cards with their own buttons in the footer (like land) render as plain boxes.
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" disabled={locked} onClick={onClick} className={className}>
      {body}
    </button>
  );
}
