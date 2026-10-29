import { Suspense } from "react";
import { ExploreShell } from "@/components/explore/explore-shell";
import { SiteIndex } from "@/components/seo/site-index";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import type { EventListItem } from "@/lib/events";
import { messages, type Locale } from "@/lib/i18n/messages";
import { CataloguePreview } from "@/components/seo/catalogue-preview";
import MapLoading from "@/app/[locale]/(shell)/(map)/loading";

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
      {/* nuqs reads search params and suspends during static rendering. Keep
          that bailout inside the map, so the server index below still ships
          as HTML instead of disappearing into the route's loading shell. */}
      <Suspense
        fallback={
          <>
            {/* The map's own shell is what people see while it loads; the
                race list is for crawlers and screen readers, and is there in
                the HTML without ever being drawn. */}
            <MapLoading />
            <div className="sr-only">
              <CataloguePreview locale={locale} view="map" />
            </div>
          </>
        }
      >
        <ExploreShell
          initialEvents={initialEvents}
          messages={messages[locale]}
          locale={locale}
        />
      </Suspense>
      {/* Streamed after the map's shell, so it never holds the first paint. */}
      <Suspense fallback={null}>
        <SiteIndex locale={locale} />
      </Suspense>
    </>
  );
}
