"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CirclePlus, CircleUserRound, Info, Menu } from "lucide-react";
import { AccountMenuItems, signOutAndRefresh } from "@/components/explore/map-account-button";
import { exploreNav, profileNav, type NavItem } from "@/components/shell/nav-items";
import { MoreSheet } from "@/components/shell/more-sheet";
import { useCarryFilters } from "@/components/shell/use-carried-query";
import { useNavCounts } from "@/components/shell/use-nav-counts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuthUser } from "@/hooks/use-auth-user";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/localized-paths";

const SubmitRaceModal = dynamic(() =>
  import("@/components/explore/submit-race-modal").then((m) => ({ default: m.SubmitRaceModal })),
);
const FeedbackModal = dynamic(() =>
  import("@/components/explore/feedback-modal").then((m) => ({ default: m.FeedbackModal })),
);
const AuthDialog = dynamic(() =>
  import("@/components/account/auth-dialog").then((m) => ({ default: m.AuthDialog })),
);

function NavGroup({ items, carry }: { items: NavItem[]; carry?: ReturnType<typeof useCarryFilters> }) {
  return (
    <SidebarGroup className="px-0 py-1">
      <SidebarGroupContent>
        <SidebarMenu className="items-center gap-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton asChild isActive={item.active} tooltip={item.label} className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-brand">
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  onClick={carry?.(item.href)}
                >
                  <item.icon strokeWidth={item.active ? 2.25 : 2} />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
              {item.badge ? (
                // The sidebar hides its own badge when it collapses to icons,
                // and icons are all this one ever shows — so the count rides
                // on the corner of the icon instead.
                <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-none font-medium text-white tabular-nums">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function initials(email: string | null): string {
  if (!email) return "";
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

/** Who is signed in, at the foot of the sidebar, with everything that is theirs. */
function UserMenu({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const router = useRouter();
  const { authed, email } = useAuthUser();
  const [dialog, setDialog] = useState<"auth" | "submit" | "feedback" | null>(null);
  const pathname = usePathname() ?? "";
  const aboutHref = localePath(locale, "about");
  const aboutActive = pathname.startsWith(aboutHref);

  return (
    <>
      <SidebarMenu className="items-center gap-2">
        {/* What has nowhere else to live, laid out where it can be seen —
            adding a race and who we are — with the rest behind the last icon. */}
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={t.missingRace} onClick={() => setDialog("submit")}>
            <CirclePlus strokeWidth={2} />
            <span>{t.missingRace}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={aboutActive}
            tooltip={t.navAbout}
            className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-brand"
          >
            <Link href={aboutHref} aria-current={aboutActive ? "page" : undefined}>
              <Info strokeWidth={aboutActive ? 2.25 : 2} />
              <span>{t.navAbout}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {authed && email ? (
                <SidebarMenuButton size="lg" tooltip={email} className="justify-center">
                  <Avatar size="sm" className="size-8">
                    <AvatarFallback className="bg-foreground text-xs font-medium text-background">
                      {initials(email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">{t.account}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton tooltip={t.account}>
                  <CircleUserRound strokeWidth={2} />
                  <span>{t.account}</span>
                </SidebarMenuButton>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
              <AccountMenuItems
                authed={authed}
                email={email}
                locale={locale}
                messages={t}
                showAbout={false}
                onSignIn={() => setDialog("auth")}
                onFeedback={() => setDialog("feedback")}
                onSignOut={() => void signOutAndRefresh(router)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      {dialog === "submit" ? <SubmitRaceModal open onClose={() => setDialog(null)} messages={t} /> : null}
      {dialog === "feedback" ? <FeedbackModal open onClose={() => setDialog(null)} /> : null}
      {dialog === "auth" ? (
        <AuthDialog open onClose={() => setDialog(null)} onSuccess={() => setDialog(null)} locale={locale} />
      ) : null}
    </>
  );
}

/**
 * The sidebar: three ways to look at the races, then everything that is yours,
 * then you.
 *
 * Icons only, with the name on hover — the shape of the tools this app is used
 * next to. The three views share one set of filters and the links between them
 * carry it along; the profile's pages sit under a rule because they are
 * somewhere else; the account itself is at the foot, where it always is.
 */
export function AppSidebar({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const pathname = usePathname() ?? "";
  const carry = useCarryFilters();
  const { authed } = useAuthUser();
  const counts = useNavCounts(pathname, authed);

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      aria-label={t.navPrimary}
      className="p-0 py-1.5 md:group-data-[collapsible=icon]:w-14"
    >
      <SidebarContent className="gap-0 pt-2">
        <NavGroup items={exploreNav(locale, t, pathname)} carry={carry} />
        <SidebarSeparator className="mx-auto my-2.5 data-[orientation=horizontal]:w-8" />
        <NavGroup items={profileNav(locale, t, pathname, counts, authed)} />
      </SidebarContent>
      <SidebarFooter className="items-center px-0 pb-2.5">
        <UserMenu locale={locale} />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * The same destinations for a phone: a row along the bottom on every screen,
 * the map included, where the race sheet rides on top of it.
 *
 * Four views and "More", which holds the account and everything else.
 * Each icon carries a one-word name under it. Five bare icons asked people to
 * guess which grid meant "browse" and which list meant "list"; the words fit
 * in the same 52 points the icons alone used to take.
 */
export function MobileTabBar({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const pathname = usePathname() ?? "";
  const carry = useCarryFilters();
  const { authed, email } = useAuthUser();
  const counts = useNavCounts(pathname, authed);
  const [moreOpen, setMoreOpen] = useState(false);
  // Loaded on first use and kept, so it can finish closing.
  const [moreMounted, setMoreMounted] = useState(false);
  if (moreOpen && !moreMounted) setMoreMounted(true);
  const items: NavItem[] = exploreNav(locale, t, pathname).map((item) =>
    // "Durchsuchen" and "Prehľadávať" do not fit a fifth of a 360-point phone.
    item.key === "browse" ? { ...item, label: t.tabBrowse } : item,
  );
  const moreActive =
    pathname.startsWith(localePath(locale, `account`)) || pathname.startsWith(localePath(locale, "about"));
  const moreBadge = counts.action + counts.alerts;
  const tabClass = (active: boolean) =>
    cn(
      "relative flex min-w-0 flex-col items-center justify-center gap-1 transition-[color,scale] duration-150 ease-out touch-manipulation active:scale-[0.92] motion-reduce:transition-none motion-reduce:active:scale-100",
      active ? "text-brand" : "text-muted-foreground",
    );
  const badge = (n: number) =>
    n ? (
      <span className="absolute top-1 left-1/2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-none font-medium text-white tabular-nums">
        {n > 9 ? "9+" : n}
      </span>
    ) : null;

  return (
    <nav
      aria-label={t.navTabs}
      className="relative z-40 grid h-[var(--mobile-tabbar)] shrink-0 grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          onClick={carry(item.href)}
          className={tabClass(item.active)}
        >
          <item.icon className="size-[22px]" strokeWidth={item.active ? 2.25 : 1.75} aria-hidden />
          <span className={cn("max-w-full truncate px-0.5 text-[11px] leading-none", item.active && "font-semibold")}>
            {item.label}
          </span>
          {badge(item.badge ?? 0)}
        </Link>
      ))}
      {/* The account, its pages and the rest — one sheet instead of a
          profile tab here and a person icon over the map. */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        aria-current={moreActive ? "page" : undefined}
        onClick={() => setMoreOpen(true)}
        className={tabClass(moreActive || moreOpen)}
      >
        <Menu className="size-[22px]" strokeWidth={moreActive ? 2.25 : 1.75} aria-hidden />
        <span className={cn("max-w-full truncate px-0.5 text-[11px] leading-none", moreActive && "font-semibold")}>
          {t.navMore}
        </span>
        {badge(moreBadge)}
      </button>
      {moreMounted ? (
        <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} locale={locale} authed={authed} email={email} counts={counts} />
      ) : null}
    </nav>
  );
}
