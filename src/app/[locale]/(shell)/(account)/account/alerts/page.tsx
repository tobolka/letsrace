import type { Metadata } from "next";
import { AlertsPanel } from "@/components/account/alerts-panel";
import { messagesFor } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: { absolute: `${messagesFor(locale).discoverWatching} · ${SITE_NAME}` }, robots: { index: false } };
}

/**
 * Race alerts, on a page of their own.
 *
 * They were a tab inside Discover, which put a setting you make once behind a
 * page you visit to browse — and gave that page two buttons that both said
 * "set up alerts". The sidebar has room for it, so it has its own place.
 */
export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <AlertsPanel locale={locale} />;
}
