import type { Metadata } from "next";
import { messagesFor } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";
import { RidersPanel } from "@/components/account/riders-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The locale layout sets a plain title, which drops the root template.
  return { title: { absolute: `${messagesFor(locale).profilesTitle} · ${SITE_NAME}` }, robots: { index: false } };
}

export default async function RidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <RidersPanel locale={locale} />;
}
