"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The page's heading, repeated in the middle of the sticky logo bar once the
 * real one has scrolled under it — so a long list still says what it is.
 * Reads the `h1[data-page-title]` the page renders; the bar's copy is hidden
 * from assistive tech, which has the heading itself.
 */
export function StickyPageTitle() {
  const [title, setTitle] = useState("");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("h1[data-page-title]");
    if (!heading) return;
    // The 48px bar covers the top of the scroller: the heading counts as gone
    // once it is fully under the bar.
    const observer = new IntersectionObserver(
      ([entry]) => {
        setTitle(heading.textContent ?? "");
        setShown(!entry!.isIntersecting && entry!.boundingClientRect.top < 0);
      },
      { root: document.getElementById("shell-stage"), rootMargin: "-48px 0px 0px 0px" },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onClick={() => document.getElementById("shell-stage")?.scrollTo({ top: 0, behavior: "smooth" })}
      // Beside the logo on a phone, where the middle is taken; centred above it.
      className={cn(
        "ml-4 min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-tight transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
        "sm:absolute sm:left-1/2 sm:top-1/2 sm:ml-0 sm:max-w-[min(40rem,calc(100%-16rem))] sm:flex-none sm:-translate-x-1/2 sm:text-center",
        shown ? "translate-y-0 opacity-100 sm:-translate-y-1/2" : "pointer-events-none translate-y-1 opacity-0 sm:-translate-y-[30%]",
      )}
    >
      {title}
    </button>
  );
}
