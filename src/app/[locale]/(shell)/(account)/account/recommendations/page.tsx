import type { Metadata } from "next";
import Link from "next/link";
import { Compass, BellRing, MapPinned } from "lucide-react";
import { isMatch } from "date-fns";
import { PlanHome } from "@/components/account/plan-home";
import { AlertsPanel } from "@/components/account/alerts-panel";
import { PageHeader, PAGE_WIDTH } from "@/components/account/panel";
import { Button } from "@/components/ui/button";
import { messagesFor } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";

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
  const t = messagesFor(locale);
  const day = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) && isMatch(query.day, "yyyy-MM-dd") ? query.day : undefined;
  const watching = query.tab === "watching";
  const base = `/${locale}/account/recommendations`;
  const suffix = day ? `day=${day}&` : "";
  const tabs = [
    { active: !watching, label: t.discoverForYou, href: `${base}${day ? `?day=${day}` : ""}`, icon: Compass },
    { active: watching, label: t.discoverWatching, href: `${base}?${suffix}tab=watching`, icon: BellRing },
  ];

  return (
    <div className={PAGE_WIDTH}>
      <PageHeader
        title={t.discoverHeadline}
        description={t.discoverDescription}
        actions={
          <Button asChild variant="outline">
            <Link href={`/${locale}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        }
      >
        {/* Two views of one question, so a segmented control rather than two
            pages: the same bar the map's Date / Distance switch uses. */}
        <nav
          aria-label={t.accountDiscover}
          className="flex w-fit max-w-full gap-0.5 rounded-lg border bg-muted/60 p-0.5"
        >
          {tabs.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-11",
                item.active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {watching ? <AlertsPanel locale={locale} embedded /> : <PlanHome key={day ?? "all"} locale={locale} section="recommendations" day={day} />}
    </div>
  );
}
