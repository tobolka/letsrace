import type { Metadata } from "next";
import { listEvents } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import { FastMapPrototype } from "@/components/prototypes/fast-map/prototype";

export const metadata: Metadata = {
  title: "Prototyp rychlé mapy",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default async function MapPrototypePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ engine?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const range = thisWeekendRange();
  const initialEvents = await listEvents({ dateFrom: range.from, dateTo: range.to, west: 5, east: 25, south: 44, north: 56 });
  return <FastMapPrototype initialEvents={initialEvents} locale={locale} weekend={range} initialEngine={query.engine === "current" ? "current" : "light"} />;
}
