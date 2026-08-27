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
