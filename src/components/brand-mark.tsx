import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";

export function BrandMark({
  href,
  size = "md",
  tone = "brand",
  mark = "full",
  className,
}: {
  href?: string;
  size?: "sm" | "md";
  tone?: "brand" | "inverse";
  /** `lr` = compact red initials for tight chrome (mobile sheet). */
  mark?: "full" | "lr";
  className?: string;
}) {
  const word = (
    <span
      className={cn(
        "font-black italic leading-none tracking-[-0.04em]",
        tone === "inverse" ? "text-white" : "text-brand",
        // The initials are italic, so their ink sits right of the box that gets
        // centred — measured at 1.6px right and 0.5px high on a 44px button.
        // Nudged back by that, in em, so it holds at any size.
        mark === "lr" && "translate-x-[-0.097em] translate-y-[-0.032em]",
        mark === "lr"
          ? size === "sm"
            ? "text-[1.05rem]"
            : "text-[1.2rem]"
          : size === "sm"
            ? "text-[1.35rem]"
            : "text-[1.6rem]",
        className,
      )}
    >
      {mark === "lr" ? "LR" : SITE_NAME}
    </span>
  );

  if (!href) return word;

  return (
    <Link
      href={href}
      aria-label={SITE_NAME}
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm outline-offset-4 focus-visible:outline-2",
        tone === "inverse" && "focus-visible:outline-white",
      )}
    >
      {word}
    </Link>
  );
}
