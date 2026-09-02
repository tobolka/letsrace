"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, LogOut, Map, Moon, Search, Sun, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AccountCommand } from "@/components/account/account-command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { messagesFor } from "@/lib/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { todayIso } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

const THEME_KEY = "letsrace-theme";

type Counts = { action: number; alerts: number };

export function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = messagesFor(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [counts, setCounts] = useState<Counts>({ action: 0, alerts: 0 });
  const [dark, setDark] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const planHref = `/${locale}/calendar`;
  const alertsHref = `/${locale}/alerts`;
  const accountHref = `/${locale}/account`;
  const mapHref = `/${locale}`;

  useEffect(() => {
    const supabase = createBrowserSupabase();
    void supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

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
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_KEY);
    } catch {
      /* private windows have no storage; light is a fine default */
    }
    setDark(stored === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(mapHref);
  }

  const nav = [
    { href: planHref, label: t.myCalendar, icon: CalendarDays, match: "/calendar", badge: counts.action },
    { href: alertsHref, label: t.alertTitle, icon: Bell, match: "/alerts", badge: counts.alerts },
    { href: accountHref, label: t.account, icon: UserRound, match: "/account", badge: 0 },
    { href: mapHref, label: t.viewOnMap, icon: Map, match: "__map__", badge: 0 },
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset" className="hidden md:flex">
        <SidebarHeader className="border-b">
          <BrandMark href={mapHref} size="sm" className="px-1 group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href + item.match}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.match !== "__map__" && pathname?.includes(item.match)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge > 0 ? (
                      <SidebarMenuBadge>{item.badge > 99 ? "99+" : item.badge}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        {authed ? (
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={t.signOut} onClick={() => void signOut()}>
                  <LogOut />
                  <span>{t.signOut}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        ) : null}
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur">
          <BrandMark href={mapHref} size="sm" className="md:hidden" />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">{t.searchPlaceholder}</span>
              <kbd className="hidden rounded border bg-muted px-1 text-[10px] sm:inline">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "Light" : "Dark"}
              onClick={toggleTheme}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Separator orientation="vertical" className="mx-1 hidden h-4 md:block" />
            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
              <Link href={mapHref}>{t.viewOnMap}</Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </div>

        {/* A phone reaches the bottom of the screen, not a hamburger in the
            corner. Four destinations, each with its own outstanding count. */}
        <nav
          aria-label={t.account}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {nav.map((item) => {
            const active = item.match !== "__map__" && pathname?.includes(item.match);
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
                <span className="max-w-full truncate px-1">{item.label}</span>
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
      </SidebarInset>

      <AccountCommand
        locale={locale}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        dark={dark}
        onToggleTheme={toggleTheme}
      />
    </SidebarProvider>
  );
}
