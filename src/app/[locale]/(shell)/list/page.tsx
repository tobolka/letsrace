import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListView } from "@/components/shell/list-view";
import { locales, messagesFor, type Locale } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";

/**
 * Rendered per request, as it always was: the view reads its filters from the
 * address (nuqs), which a prerendered page cannot have. Every page used to be
 * dynamic because the root layout read a header; this one still needs to be.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The locale layout sets a plain title, which drops the root template.
  return { title: { absolute: `${messagesFor(locale).navList} · ${SITE_NAME}` } };
}

export default async function ListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <ListView locale={locale} />;
}
