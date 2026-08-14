import { Suspense } from "react";
import { ExploreShell } from "@/components/explore/explore-shell";
import { listEvents } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
  const events = await listEvents({
    dateFrom: one("dateFrom") || new Date().toISOString().slice(0, 10),
    dateTo: one("dateTo"),
    seriesSlug: one("series"),
    countryCodes: many("country"),
    ageCategories: many("categories"),
    disciplines: many("disciplines"),
    levels: many("levels"),
    q: one("q"),
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
