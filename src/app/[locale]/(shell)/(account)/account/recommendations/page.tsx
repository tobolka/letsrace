import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMatch } from "date-fns";
import { PlanHome } from "@/components/account/plan-home";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { DOC_WIDTH, PageHeader } from "@/components/account/panel";
import { Button } from "@/components/ui/button";
import { messagesFor } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";
import { localePath } from "@/lib/localized-paths";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The locale layout sets a plain title, which drops the root template.
  return { title: { absolute: `${messagesFor(locale).accountDiscover} · ${SITE_NAME}` }, robots: { index: false } };
}

export default async function RecommendationsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ day?: string; tab?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  // Alerts moved out of this page; old links to the tab still land on them.
  if (query.tab === "watching") redirect(localePath(locale, `account/alerts`));
  const t = messagesFor(locale);
  const day = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) && isMatch(query.day, "yyyy-MM-dd") ? query.day : undefined;

  return (
    <div className={DOC_WIDTH}>
      <PageHeader
        title={t.accountDiscover}
        description={t.discoverIntro}
        actions={
          <Button asChild variant="outline">
            <Link href={localePath(locale, `account/alerts`)}>
              <MapPin data-icon="inline-start" />
              {t.areasTitle}
            </Link>
          </Button>
        }
      />
      <PlanHome key={day ?? "all"} locale={locale} section="recommendations" day={day} />
    </div>
  );
}
