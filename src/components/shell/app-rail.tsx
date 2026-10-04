"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { AccountMenuItems, signOutAndRefresh } from "@/components/explore/map-account-button";
import { exploreNav, profileNav, type NavItem } from "@/components/shell/nav-items";
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
              <SidebarMenuButton asChild isActive={item.active} tooltip={item.label} className="data-[active=true]:bg-brand/8 data-[active=true]:text-brand">
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

  return (
    <>
      <SidebarMenu className="items-center">
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip={email ?? t.account} className="justify-center">
                <Avatar size="sm" className="size-8">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-medium",
                      authed ? "bg-foreground text-background" : "bg-sidebar-accent text-muted-foreground",
                    )}
                  >
                    {authed && email ? initials(email) : <UserRound className="size-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">{t.account}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
              <AccountMenuItems
                authed={authed}
                email={email}
                locale={locale}
                messages={t}
                onSignIn={() => setDialog("auth")}
                onSubmitRace={() => setDialog("submit")}
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
 * The same destinations for a phone: a row of icons along the bottom, the way
 * Instagram does it — on every screen, the map included, where the race sheet
 * now rides on top of it. Names are for screen readers; the icons carry it.
 */
export function MobileTabBar({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const pathname = usePathname() ?? "";
  const carry = useCarryFilters();
  const { authed } = useAuthUser();
  const counts = useNavCounts(pathname, authed);
  const items: NavItem[] = [
    ...exploreNav(locale, t, pathname),
    {
      key: "profile",
      href: `/${locale}/account`,
      label: t.navProfileGroup,
      icon: UserRound,
      active: pathname.startsWith(`/${locale}/account`),
      badge: counts.action + counts.alerts,
    },
  ];

  return (
    <nav
      aria-label={t.navTabs}
      className="relative z-40 grid h-[var(--mobile-tabbar)] shrink-0 grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-label={item.label}
          aria-current={item.active ? "page" : undefined}
          onClick={item.key === "profile" ? undefined : carry(item.href)}
          className={cn(
            "relative flex items-center justify-center transition-[color,scale] duration-150 ease-out touch-manipulation active:scale-[0.92] motion-reduce:transition-none motion-reduce:active:scale-100",
            item.active ? "text-brand" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-6" strokeWidth={item.active ? 2.25 : 1.75} aria-hidden />
          {item.badge ? (
            <span className="absolute top-2 left-1/2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-none font-medium text-white tabular-nums">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
