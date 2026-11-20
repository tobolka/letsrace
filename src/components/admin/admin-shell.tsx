"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Command as CommandIcon,
  Flag,
  Inbox,
  LayoutDashboard,
  Map,
  Plus,
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_NAME } from "@/lib/seo";

type WorkCounts = {
  tasks: number;
  inbox: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  /** Which number belongs on this row, if any. */
  count?: keyof WorkCounts;
};

/**
 * Three places, all of them the owner's: the list of what needs them, the
 * riders who wrote in, and the races to look up or fix by hand. The machines'
 * queues have no page here; the agent and the Mac clear them.
 */
const NAV: NavItem[] = [
  { href: "/admin", label: "Co potřebuje tebe", icon: LayoutDashboard, exact: true, count: "tasks" },
  { href: "/admin/inbox", label: "Zprávy od uživatelů", icon: Inbox, exact: false, count: "inbox" },
  { href: "/admin/events", label: "Závody", icon: Flag, exact: false },
  { href: "/admin/events/new", label: "Přidat závod", icon: Plus, exact: true },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  if (href === "/admin/events") {
    return pathname === "/admin/events" || (pathname.startsWith("/admin/events/") && pathname !== "/admin/events/new");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbFor(pathname: string): string {
  if (pathname === "/admin/events/new") return "Přidat závod";
  if (pathname.startsWith("/admin/events/")) return "Závod";
  return NAV.find((n) => isActive(pathname, n.href, n.exact))?.label ?? "Admin";
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
        <SidebarMenuBadge>
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
                {NAV.map((item) => (
                  <NavRow key={item.href} item={item} pathname={pathname} counts={counts} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Mapa">
                <Link href="/cs">
                  <Map />
                  <span>Zpět na mapu</span>
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
            {counts && counts.tasks > 0 && pathname !== "/admin" ? (
              <Link href="/admin" className="shrink-0">
                <Badge variant="secondary" className="tabular-nums">
                  Potřebuju tě: {counts.tasks}
                </Badge>
              </Link>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => setPaletteOpen(true)}
              >
                <CommandIcon className="size-3.5" />
                <span className="hidden sm:inline">Hledat závod</span>
                <kbd className="hidden rounded border bg-muted px-1 text-[10px] sm:inline">⌘K</kbd>
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
