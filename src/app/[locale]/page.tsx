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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = (raw as Locale) || defaultLocale;
  const events = await listEvents({
    dateFrom: new Date().toISOString().slice(0, 10),
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
