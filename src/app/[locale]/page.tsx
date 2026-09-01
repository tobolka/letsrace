import { Suspense } from "react";
import { ExploreShell } from "@/components/explore/explore-shell";
import { listEvents, getPublicEventBySlug } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { notFound, redirect } from "next/navigation";

/** Cache the explore shell briefly; client refetch handles bbox. */
export const revalidate = 120;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocalePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = (raw as Locale) || defaultLocale;
  const sp = await searchParams;
  const one = (key: string) => {
    const v = sp[key];
    return typeof v === "string" && v ? v : undefined;
  };
  const many = (key: string) => {
    const v = sp[key];
    if (Array.isArray(v)) return v.filter(Boolean);
    return typeof v === "string" && v ? [v] : [];
  };
  const weekend = thisWeekendRange();
  const slug = one("e");
  const focused = slug ? await getPublicEventBySlug(slug) : null;
  if (focused && (!one("dateFrom") || !one("dateTo"))) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string" && value) next.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (item) next.append(key, item);
        }
      }
    }
    next.set("e", focused.slug);
    if (!one("dateFrom")) next.set("dateFrom", focused.startDate);
    if (!one("dateTo")) next.set("dateTo", focused.endDate || focused.startDate);
    redirect(`/${locale}?${next.toString()}`);
  }
  const dateFrom = one("dateFrom") || weekend.from;
  const dateTo = one("dateTo") || (one("dateFrom") ? undefined : weekend.to);
  const events = await listEvents({
    dateFrom,
    dateTo,
    seriesSlug: one("series"),
    countryCodes: many("country"),
    ageCategories: many("categories"),
    disciplines: many("disciplines"),
    levels: many("levels"),
    q: one("q"),
  });
  /**
   * The list is placeholders until the map settles on its real bounds and
   * fetches its own set, so everything sent here beyond the first screen is
   * serialised into the page, hydrated, and thrown away — it was 257 KB of the
   * 273 KB document. What is still worth sending is enough pins for the map's
   * first paint, a list to fall back on if the map never loads, and the race
   * someone followed a link to.
   */
  const INITIAL_LIST = 40;
  const head = events.slice(0, INITIAL_LIST);
  const initialEvents =
    focused && !head.some((e) => e.id === focused.id) ? [focused, ...head] : head;

  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center text-sm text-stone-500">
          Loading map…
        </div>
      }
    >
      <ExploreShell initialEvents={initialEvents} messages={messages[locale]} locale={locale} />
    </Suspense>
  );
}
