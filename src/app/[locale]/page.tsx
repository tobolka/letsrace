import { Suspense } from "react";
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
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-stone-100" aria-hidden />}>
      <ExploreShell messages={messages[locale]} locale={locale} />
    </Suspense>
  );
}
