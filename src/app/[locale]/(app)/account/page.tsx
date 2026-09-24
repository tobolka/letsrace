import type { Metadata } from "next";
import { messagesFor } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";
import { PlanHome } from "@/components/account/plan-home";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The locale layout sets a plain title, which drops the root template.
  return { title: { absolute: `${messagesFor(locale).myCalendar} · ${SITE_NAME}` }, robots: { index: false } };
}

/**
 * The account is the plan.
 *
 * It used to be three siblings — `/calendar` for the season, `/account` for the
 * profile, `/alerts` for the watchlist — which put the reason people sign in on
 * a URL that sounded like a date picker, and settings on the one that sounded
 * like the product. The plan is what an account is for, so it is what an
 * account opens on; everything else sits underneath it.
 */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PlanHome locale={locale} />;
}
