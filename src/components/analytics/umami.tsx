"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { analyticsSection } from "@/lib/analytics-product";
import { createAnalyticsBeforeSend, setAnalyticsEnabled, flushAnalytics, track } from "@/lib/analytics";

export function Umami() {
  const pathname = usePathname();
  const lastSection = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const testId = process.env.NEXT_PUBLIC_UMAMI_TEST_WEBSITE_ID;
  const testing = process.env.NEXT_PUBLIC_UMAMI_TEST_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";
  const production = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
  const id = testing ? testId : production ? websiteId : undefined;

  useEffect(() => {
    const productionHost = window.location.hostname === "letsrace.cz";
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || (!testing && !productionHost) ||
      nav.globalPrivacyControl || navigator.doNotTrack === "1" || navigator.doNotTrack === "yes") return;
    window.letsraceAnalyticsBeforeSend = createAnalyticsBeforeSend(window.location.origin);
    setAnalyticsEnabled(true);
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => { window.clearTimeout(timer); delete window.letsraceAnalyticsBeforeSend; setAnalyticsEnabled(false); };
  }, [id, testing]);

  useEffect(() => {
    if (!ready || !pathname || lastSection.current === pathname) return;
    lastSection.current = pathname;
    const section = analyticsSection(pathname);
    if (section) track("section_view", section);
  }, [pathname, ready]);

  if (!ready || !id) return null;
  return <Script
    id="umami-analytics"
    src="https://stats.letsrace.cz/s.js"
    strategy="afterInteractive"
    onReady={flushAnalytics}
    data-website-id={id}
    data-host-url="https://stats.letsrace.cz"
    data-domains={testing ? undefined : "letsrace.cz"}
    data-do-not-track="true"
    data-exclude-hash="true"
    data-before-send="letsraceAnalyticsBeforeSend"
  />;
}
