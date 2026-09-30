import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScheduleView } from "@/components/shell/schedule-view";
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
  return { title: { absolute: `${messagesFor(locale).navSchedule} · ${SITE_NAME}` } };
}

export default async function SchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <ScheduleView locale={locale} />;
}
