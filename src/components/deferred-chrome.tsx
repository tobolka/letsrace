"use client";

import { useEffect, useState } from "react";

/**
 * Defer Vercel beacons + WebMCP until after first paint so they stay out of TBT.
 */
export function DeferredChrome() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };
    const ric = window.requestIdleCallback?.(enable, { timeout: 4000 });
    const t = window.setTimeout(enable, 3500);
    return () => {
      cancelled = true;
      if (ric != null) window.cancelIdleCallback?.(ric);
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) return null;

  return <DeferredChromeInner />;
}

function DeferredChromeInner() {
  const [nodes, setNodes] = useState<React.ReactNode>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      import("@vercel/analytics/next"),
      import("@vercel/speed-insights/next"),
      import("@/components/agent/webmcp-tools"),
    ]).then(([analytics, speed, webmcp]) => {
      if (cancelled) return;
      const Analytics = analytics.Analytics;
      const SpeedInsights = speed.SpeedInsights;
      const WebMcpTools = webmcp.WebMcpTools;
      setNodes(
        <>
          <WebMcpTools />
          <Analytics />
          <SpeedInsights />
        </>,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return nodes;
}
