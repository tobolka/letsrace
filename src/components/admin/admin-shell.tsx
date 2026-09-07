"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Command as CommandIcon,
  Flag,
  Globe,
  CopyCheck,
  Inbox,
  LayoutDashboard,
  Link2Off,
  Map,
  Plus,
  Radar,
  TriangleAlert,
} from "lucide-react";
import { AdminCommand } from "@/components/admin/admin-command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SITE_NAME } from "@/lib/seo";

type WorkCounts = {
  discovery: number;
  inbox: number;
  stalled: number;
  unlinked: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  /** Which waiting-work number belongs on this row, if any. */
  count?: keyof WorkCounts;
  /** Waiting work is amber; a broken source is not the same as a full inbox. */
  urgent?: boolean;
};

/**
 * Two groups, because there are two jobs here.
 *
 * "Waiting" is everything that needs a person and can be finished: links to
 * judge, riders to answer, duplicates to call, races with a hole in them. Each
 * carries its own number, so the sidebar is the queue and the overview is not
 * the only place that knows whether anything is outstanding.
 *
 * "Catalogue" is what you browse rather than clear — the races and the sources
 * they come from. It has no counts because a count of everything is not work.
 */
const WAITING: NavItem[] = [
  { href: "/admin/discovery", label: "Discovery", icon: Radar, exact: false, count: "discovery" },
  { href: "/admin/inbox", label: "Inbox", icon: Inbox, exact: false, count: "inbox" },
  { href: "/admin/duplicates", label: "Duplicates", icon: CopyCheck, exact: false },
  {
    href: "/admin/events?missing=website",
    label: "Missing a link",
    icon: Link2Off,
    exact: false,
    count: "unlinked",
  },
];

const CATALOGUE: NavItem[] = [
  { href: "/admin/events", label: "Races", icon: Flag, exact: false },
  { href: "/admin/sources", label: "Sources", icon: Globe, exact: false, count: "stalled", urgent: true },
];

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  ...WAITING,
  ...CATALOGUE,
];

function isActive(pathname: string, href: string, exact: boolean) {
  // Some rows are a filtered view of a page rather than a page: "Missing a
  // link" is /admin/events with a query on it. Highlight the page it lives in
  // rather than nothing at all.
  const path = href.split("?")[0] ?? href;
  if (exact) return pathname === path;
  if (path !== href) return false;
  if (href === "/admin/events") {
    return (
      pathname === "/admin/events" ||
      (pathname.startsWith("/admin/events/") && pathname !== "/admin/events/new")
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function crumbFor(pathname: string): string {
  const item = NAV.find((n) => isActive(pathname, n.href, n.exact));
  if (pathname === "/admin/events/new") return "Add a race";
  if (pathname.startsWith("/admin/events/")) return "Race";
  return item?.label ?? "Admin";
}

/** One row of the sidebar, with its number when it has work on it. */
function NavRow({
  item,
  pathname,
  counts,
}: {
  item: NavItem;
  pathname: string;
  counts: WorkCounts | null;
}) {
  const n = item.count && counts ? counts[item.count] : 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(pathname, item.href, item.exact)}
        tooltip={item.label}
      >
        <Link href={item.href}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {n > 0 ? (
        <SidebarMenuBadge className={item.urgent ? "text-amber-600" : undefined}>
          {n > 999 ? "999+" : n}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onLogin = pathname === "/admin/login";
  const [counts, setCounts] = useState<WorkCounts | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The badges are the reason to open the admin at all, so they are refreshed
  // while you work rather than frozen at the moment the page was rendered.
  useEffect(() => {
    if (onLogin) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/work");
        if (!res.ok) return;
        const data = (await res.json()) as WorkCounts;
        if (alive) setCounts(data);
      } catch {
        /* the shell works fine without numbers on it */
      }
    };
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [onLogin, pathname]);


  useEffect(() => {
    if (onLogin) return;
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLogin]);

  if (onLogin) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        {children}
        <Toaster theme="light" />
      </div>
    );
  }

  const waiting = counts ? counts.discovery + counts.inbox : 0;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/admin">
                  <Flag />
                  <span className="font-black italic tracking-[-0.04em]">{SITE_NAME}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(pathname, "/admin", true)}
                    tooltip="Overview"
                  >
                    <Link href="/admin">
                      <LayoutDashboard />
                      <span>Overview</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Waiting for you</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {WAITING.map((item) => (
                  <NavRow key={item.href} item={item} pathname={pathname} counts={counts} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Catalogue</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {CATALOGUE.map((item) => (
                  <NavRow key={item.href} item={item} pathname={pathname} counts={counts} />
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Add a race by hand">
                    <Link href="/admin/events/new">
                      <Plus />
                      <span>Add a race</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Map">
                <Link href="/en">
                  <Map />
                  <span>Back to map</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <TooltipProvider delayDuration={400}>
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="truncate text-sm font-medium">{crumbFor(pathname)}</span>
            {waiting > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {waiting} waiting
              </Badge>
            ) : null}
            {counts && counts.stalled > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/admin" className="shrink-0">
                    <Badge variant="outline" className="gap-1 tabular-nums">
                      <TriangleAlert className="size-3 text-amber-600 dark:text-amber-500" />
                      {counts.stalled}
                    </Badge>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Sources that look stalled</TooltipContent>
              </Tooltip>
            ) : null}

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => setPaletteOpen(true)}
              >
                <CommandIcon className="size-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded border bg-muted px-1 text-[10px] sm:inline">⌘K</kbd>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/en">Map</Link>
              </Button>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </TooltipProvider>
      </SidebarInset>
      <AdminCommand open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster theme="light" />
    </SidebarProvider>
  );
}
