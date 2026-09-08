"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Map, Users, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AccountCommand } from "@/components/account/account-command";
import { MapAccountButton } from "@/components/explore/map-account-button";
import { Badge } from "@/components/ui/badge";
import { messagesFor } from "@/lib/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { todayIso } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

type Counts = { action: number; alerts: number };

/**
 * One bar across the top, the same one the map wears.
 *
 * The account used to sit inside a left sidebar: two hundred pixels of chrome
 * down the side of a page whose main object is a table as wide as the screen,
 * and a layout that looked like a different product from the map it belongs
 * to. The map puts its brand top-left and its account control top-right; this
 * does the same, with the destinations between them — so moving between the
 * two halves of the app does not move the furniture.
 */
export function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = messagesFor(locale);
  const pathname = usePathname();
  const [counts, setCounts] = useState<Counts>({ action: 0, alerts: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The plan is the account; everything else hangs off it.
  const planHref = `/${locale}/account`;
  const mapHref = `/${locale}`;

  // What still needs doing, on the nav itself. Without it the only way to find
  // out whether anything is outstanding is to go and look.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !alive) return;
      const today = todayIso();
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const [{ data: atts }, { data: alertRows }] = await Promise.all([
        supabase
          .from("event_attendance")
          .select("event_id, status, registered, paid, event:events(start_date)")
          .eq("user_id", auth.user.id),
        supabase.from("race_alerts").select("id").eq("user_id", auth.user.id).eq("enabled", true),
      ]);

      const unsettled = new Set<string>();
      for (const row of (atts ?? []) as unknown as {
        event_id: string;
        status: string;
        paid: boolean;
        event: { start_date: string } | { start_date: string }[] | null;
      }[]) {
        const ev = Array.isArray(row.event) ? row.event[0] : row.event;
        if (!ev || ev.start_date < today) continue;
        if (row.status !== "none" && !row.paid) unsettled.add(row.event_id);
      }

      let alerts = 0;
      if (alertRows && alertRows.length > 0) {
        const { count } = await supabase
          .from("race_alert_deliveries")
          .select("*", { count: "exact", head: true })
          .in("alert_id", alertRows.map((a) => a.id))
          .gte("created_at", since.toISOString());
        alerts = count ?? 0;
      }
      if (alive) setCounts({ action: unsettled.size, alerts });
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = [
    {
      href: planHref,
      label: t.myCalendar,
      icon: CalendarDays,
      match: "__plan__",
      badge: counts.action,
    },
    {
      href: `/${locale}/account/riders`,
      label: t.profilesTitle,
      icon: Users,
      match: "/account/riders",
      badge: 0,
    },
    {
      href: `/${locale}/account/alerts`,
      label: t.alertTitle,
      icon: Bell,
      match: "/account/alerts",
      badge: counts.alerts,
    },
    {
      href: `/${locale}/account/settings`,
      label: t.account,
      icon: UserRound,
      match: "/account/settings",
      badge: 0,
    },
    // Five labels across a phone: "Zobrazit na mapě" is an ellipsis there.
    { href: mapHref, label: t.viewOnMap, short: t.navMap, icon: Map, match: "__map__", badge: 0 },
  ];

  // The plan has no path fragment of its own — every other page lives under it
  // — so it is active on an exact match and nothing else.
  const isActive = (match: string) =>
    match === "__plan__"
      ? pathname === planHref
      : match !== "__map__" && Boolean(pathname?.includes(match));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur md:px-4">
        <BrandMark href={mapHref} size="sm" className="shrink-0" />

        <nav aria-label={t.account} className="ml-4 hidden items-center gap-0.5 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href + item.match}
              href={item.href}
              aria-current={isActive(item.match) ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(item.match)
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {item.badge > 0 ? (
                <Badge className="h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums">
                  {item.badge > 99 ? "99+" : item.badge}
                </Badge>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* The map's control, unchanged: who is signed in, the language, the
            way out — one menu wherever you are. Searching for a race is what
            the map is; a second search box in this bar was a button nobody
            pressed, and ⌘K still opens the palette. */}
        <div className="ml-auto">
          <MapAccountButton locale={locale} messages={t} variant="bar" />
        </div>
      </header>

      <main className="flex flex-1 flex-col p-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        {children}
      </main>

      {/* A phone reaches the bottom of the screen, not a menu in a corner. */}
      <nav
        aria-label={t.account}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {nav.map((item) => {
          const active = isActive(item.match);
          return (
            <Link
              key={`tab-${item.href}${item.match}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
              {item.badge > 0 ? (
                <Badge
                  variant="default"
                  className="absolute right-[22%] top-1 h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums"
                >
                  {item.badge > 9 ? "9+" : item.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <AccountCommand locale={locale} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
