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
  return { title: { absolute: `${messagesFor(locale).areasTitle} · ${SITE_NAME}` }, robots: { index: false } };
}

/**
 * Your areas: the places Discover and the alert emails look around.
 *
 * This is Discover's settings page, reached from Discover's header — not a
 * section of its own. Alerts used to be one, with a feed that duplicated
 * Discover's; the feed now lives on Discover and only the settings are here.
 */
export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <AlertsPanel locale={locale} />;
}
