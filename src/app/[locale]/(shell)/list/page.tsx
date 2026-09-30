import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListView } from "@/components/shell/list-view";
import { locales, messagesFor, type Locale } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";

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
