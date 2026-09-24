import Link from "next/link";
import Image from "next/image";
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
  const word = mark === "full" ? (
    <Image
      src="/brand/lets-race.svg"
      alt={SITE_NAME}
      width={size === "sm" ? 159 : 179}
      height={size === "sm" ? 24 : 27}
      unoptimized
      className={className}
    />
  ) : (
    <span
      className={cn(
        "font-black italic leading-none tracking-[-0.04em]",
        tone === "inverse" ? "text-white" : "text-brand",
        "translate-x-[-0.097em] translate-y-[-0.032em]",
        size === "sm" ? "text-[1.05rem]" : "text-[1.2rem]",
        className,
      )}
    >
      LR
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
