import Link from "next/link";
import { Compass, BellRing, ArrowUpRight } from "lucide-react";
import { PlanHome } from "@/components/account/plan-home";
import { AlertsPanel } from "@/components/account/alerts-panel";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { isMatch } from "date-fns";

export const dynamic = "force-dynamic";

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
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
      <header className="relative overflow-hidden rounded-3xl border border-brand/10 bg-gradient-to-br from-brand/5 via-card to-card p-6 sm:p-9">
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-wide text-brand"><Compass className="size-4" />{t.accountDiscover}</div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.discoverHeadline}</h1><p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">{t.discoverDescription}</p></div>
          <Link href={`/${locale}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-80">{t.viewOnMap}<ArrowUpRight className="size-4" /></Link>
        </div>
      </header>
      <nav aria-label={t.accountDiscover} className="flex w-fit max-w-full gap-1 rounded-full border bg-muted/50 p-1">
        {[{active: !watching, label: t.discoverForYou, href: `${base}${day ? `?day=${day}` : ""}`, icon: Compass}, {active: watching, label: t.discoverWatching, href: `${base}?${suffix}tab=watching`, icon: BellRing}].map((item) => <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors sm:px-6", item.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><item.icon className="size-4 shrink-0" />{item.label}</Link>)}
      </nav>
      {watching ? <AlertsPanel locale={locale} embedded /> : <PlanHome key={day ?? "all"} locale={locale} section="recommendations" day={day} />}
    </div>
  );
}
