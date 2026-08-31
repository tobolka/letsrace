import { Suspense } from "react";
import { ExploreShell } from "@/components/explore/explore-shell";
import { listEvents } from "@/lib/events";
import { coldStartCenter } from "@/lib/coverage";
import { thisWeekendRange } from "@/lib/date-presets";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { notFound } from "next/navigation";

/** ISR — avoid searchParams/headers so the document can be cached at the edge. */
export const revalidate = 120;

/** Degrees around cold-start centre — enough for first paint, small HTML. */
const SSR_VIEWPORT_DEG = 1.6;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = (raw as Locale) || defaultLocale;
  const weekend = thisWeekendRange();
  const center = coldStartCenter(locale);
  const events = await listEvents({
    dateFrom: weekend.from,
    dateTo: weekend.to,
    west: center.lng - SSR_VIEWPORT_DEG,
    south: center.lat - SSR_VIEWPORT_DEG,
    east: center.lng + SSR_VIEWPORT_DEG,
    north: center.lat + SSR_VIEWPORT_DEG,
  });

  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center text-sm text-stone-500">
          Loading map…
        </div>
      }
    >
      <ExploreShell initialEvents={events} messages={messages[locale]} locale={locale} />
    </Suspense>
  );
}
