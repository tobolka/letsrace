import { ExploreShell } from "@/components/explore/explore-shell";
import { getPublicEventBySlug } from "@/lib/events";
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
  /**
   * No race list is fetched here, and that is the point.
   *
   * The list this used to send was never shown: the shell renders placeholder
   * rows until the map settles on its real bounds and fetches its own set, and
   * the two sets are not the same. So a second of server time went into rows
   * that were serialised, hydrated and then replaced — the whole of the wait
   * before the page appeared, spent on something nobody saw.
   *
   * The one row still worth fetching is the race someone followed a link to:
   * the map has to open on it.
   */
  const initialEvents = focused ? [focused] : [];

  // No Suspense boundary here: the data above is already awaited, so one would
  // never show. `loading.tsx` is the real boundary — it is what Next streams
  // before this component runs at all.
  return (
    <>
      {/*
        The intro photograph is the LCP element. It has to be discoverable in the
        first HTML so the preload scanner starts it before hydration — and before
        MapLibre takes the main thread. PageSpeed runs with empty storage, so this
        always matches what the lab measures; returning visitors dismiss via
        localStorage after paint.
      */}
      <link
        rel="preload"
        as="image"
        href="/intro-race.webp"
        fetchPriority="high"
      />
      <ExploreShell
        initialEvents={initialEvents}
        messages={messages[locale]}
        locale={locale}
      />
    </>
  );
}
