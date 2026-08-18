import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";

export function BrandMark({
  href,
  size = "md",
  tone = "brand",
  className,
}: {
  href?: string;
  size?: "sm" | "md";
  tone?: "brand" | "inverse";
  className?: string;
}) {
  const word = (
    <span
      className={cn(
        "font-black italic leading-none tracking-[-0.08em]",
        tone === "inverse" ? "text-white" : "text-brand",
        size === "sm" ? "text-[1.5rem]" : "text-[2rem]",
        className,
      )}
    >
      {SITE_NAME}
    </span>
  );

  if (!href) return word;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-sm outline-offset-4 focus-visible:outline-2",
        tone === "inverse" && "focus-visible:outline-white",
      )}
    >
      {word}
    </Link>
  );
}
