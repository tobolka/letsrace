"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Analytics and Speed Insights are real work on the critical path for nothing
 * the visitor asked for. Hold them until the page has painted its LCP (or a
 * short ceiling), so they cannot sit on the main thread in front of it.
 */
const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false },
);
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false },
);

function useAfterLcp(ceilingMs = 4000): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    const go = () => {
      if (cancelled || done) return;
      done = true;
      setReady(true);
    };

    const ceiling = window.setTimeout(go, ceilingMs);

    let po: PerformanceObserver | undefined;
    try {
      if (typeof PerformanceObserver !== "undefined") {
        po = new PerformanceObserver((list) => {
          if (list.getEntries().length) go();
        });
        po.observe({ type: "largest-contentful-paint", buffered: true });
      }
    } catch {
      /* older browsers — ceiling is enough */
    }

    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(go, { timeout: ceilingMs })
      : window.setTimeout(go, Math.min(2000, ceilingMs));

    return () => {
      cancelled = true;
      window.clearTimeout(ceiling);
      po?.disconnect();
      if (hasIdle) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, [ceilingMs]);

  return ready;
}

export function DeferredVitals() {
  const ready = useAfterLcp();
  if (!ready) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
