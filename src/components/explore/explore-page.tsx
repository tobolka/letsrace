import { Suspense } from "react";
import { ExploreShell } from "@/components/explore/explore-shell";
import { SiteIndex } from "@/components/seo/site-index";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import type { EventListItem } from "@/lib/events";
import { messages, type Locale } from "@/lib/i18n/messages";

/** Shared UI for cached home visits and request-specific race links. */
export function ExplorePage({ locale, initialEvents }: { locale: Locale; initialEvents: EventListItem[] }) {
  return (
    <>
      <SiteJsonLd locale={locale} />
      {/*
        Discover the intro image before hydration. AVIF-capable browsers use
        the compressed variant; the picture element provides a WebP fallback.
      */}
      <link
        rel="preload"
        as="image"
        href="/intro-race-v2.avif"
        type="image/avif"
        imageSrcSet="/intro-race-v2.avif 1x, /intro-race-v2@2x.avif 2x"
        fetchPriority="high"
      />
      <ExploreShell
        initialEvents={initialEvents}
        messages={messages[locale]}
        locale={locale}
      />
      {/* Streamed after the map's shell, so it never holds the first paint. */}
      <Suspense fallback={null}>
        <SiteIndex locale={locale} />
      </Suspense>
    </>
  );
}
