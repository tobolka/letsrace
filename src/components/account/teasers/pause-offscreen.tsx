"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * A box whose looping animations stop while it is off screen. The teaser
 * pictures drift and sweep forever; nobody is watching them once the page has
 * scrolled past, so they should not keep the phone busy.
 */
export function PauseOffscreen(props: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) el.toggleAttribute("data-offscreen", !entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} {...props} />;
}
