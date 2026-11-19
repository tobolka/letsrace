import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ScheduleView } from "@/components/shell/schedule-view";
import { locales, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, localeAlternates, SITE_NAME } from "@/lib/seo";
import { localePath } from "@/lib/localized-paths";
import { CataloguePreview } from "@/components/seo/catalogue-preview";
import { catalogueViewSeo } from "@/lib/catalogue-view-seo";

/**
 * Static shell: filters live in the address (nuqs) and the list is fetched in
 * the browser from the shared catalogue feed. Holding the shell on the CDN
 * keeps crawlers off Fluid CPU / Origin Transfer.
 */
export const revalidate = 86400;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = locales.includes(locale as Locale) ? locale as Locale : "en";
  return {
    title: { absolute: `${catalogueViewSeo[l].schedule.title} · ${SITE_NAME}` },
    description: catalogueViewSeo[l].schedule.description,
    alternates: { canonical: absoluteUrl(localePath(l, "schedule")), languages: localeAlternates("schedule") },
  };
}

export default async function SchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return (
    <Suspense fallback={<CataloguePreview locale={locale as Locale} view="schedule" />}>
      <ScheduleView locale={locale} />
    </Suspense>
  );
}
