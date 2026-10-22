import { ExplorePage } from "@/components/explore/explore-page";
import { locales, type Locale } from "@/lib/i18n/messages";
import { notFound } from "next/navigation";

/** Five shared entry pages; live map results are fetched in the browser. */
export const revalidate = 604800;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <ExplorePage locale={locale as Locale} initialEvents={[]} />;
}
