import { cn } from "cn";
import { withBasePath } from "@/lib/site";

/**
 * The Clover Fields logo: the clover tile mark, optionally with the wordmark beside it.
 * The mark is the same SVG as the favicon and app icons (public/brand/clover-mark.svg).
 */
export function Logo({
  size = 48,
  wordmark = true,
  className,
  textClassName,
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-[0.35em]", className)}>
      {/* biome-ignore lint/performance/noImgElement: a tiny static SVG, no optimisation needed */}
      <img
        src={withBasePath("/brand/clover-mark.svg")}
        width={size}
        height={size}
        alt={wordmark ? "" : "Clover Fields"}
        className="drop-shadow-[0_2px_0_rgb(0_0_0/0.15)]"
        draggable={false}
      />
      {wordmark && (
        <span
          className={cn(
            "font-display font-semibold leading-none text-white drop-shadow-[0_3px_0_#2f7d1f]",
            textClassName,
          )}
        >
          Clover Fields
        </span>
      )}
    </span>
  );
}
