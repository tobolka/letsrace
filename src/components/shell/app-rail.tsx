"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exploreNav, profileNav, type NavItem } from "@/components/shell/nav-items";
import { useCarriedQuery } from "@/components/shell/use-carried-query";
import { useNavCounts } from "@/components/shell/use-nav-counts";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

function RailLink({ item }: { item: NavItem }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-label={item.label}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-xl transition-[color,background-color,scale] duration-150 ease-out touch-manipulation active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100",
            item.active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <item.icon className="size-5" strokeWidth={item.active ? 2.25 : 1.5} aria-hidden />
          {item.badge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium leading-none text-white tabular-nums">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The left rail: three ways to look at the races, then the profile.
 *
 * Icons only, with the name on hover — the same shape as the tools this app is
 * used next to. The three views come first because they share one set of
 * filters, and the links between them carry that query along; the profile sits
 * under a rule because it is somewhere else.
 */
export function AppRail({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const pathname = usePathname() ?? "";
  const carry = useCarriedQuery();
  const counts = useNavCounts(pathname);
  const explore = exploreNav(locale, t, pathname, carry);
  const profile = profileNav(locale, t, pathname, counts);

  return (
    <nav
      aria-label={t.navPrimary}
      className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r bg-card py-3 md:flex"
    >
      {explore.map((item) => (
        <RailLink key={item.key} item={item} />
      ))}
      <Separator className="my-2 w-6" />
      {profile.map((item) => (
        <RailLink key={item.key} item={item} />
      ))}
    </nav>
  );
}

/**
 * The same destinations for a phone: four tabs along the bottom. The profile is
 * one tab; what is behind it is a row of links at the top of its own pages.
 * Not shown over the map — the map's sheet owns that edge, and the map's
 * account menu carries the way to the other views instead.
 */
export function MobileTabBar({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const pathname = usePathname() ?? "";
  const carry = useCarriedQuery();
  const counts = useNavCounts(pathname);
  if (pathname === `/${locale}`) return null;
  const explore = exploreNav(locale, t, pathname, carry);
  const profile: NavItem = {
    key: "profile",
    href: `/${locale}/account`,
    label: t.navProfileGroup,
    icon: profileNav(locale, t, pathname, counts)[0].icon,
    active: pathname.startsWith(`/${locale}/account`),
    badge: counts.action + counts.alerts,
  };
  const items = [...explore, profile];

  return (
    <nav
      aria-label={t.navTabs}
      className="z-30 grid shrink-0 grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-[color,scale] duration-150 ease-out touch-manipulation active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
            item.active ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-5" strokeWidth={item.active ? 2 : 1.5} aria-hidden />
          <span className="max-w-full truncate px-1">{item.label}</span>
          {item.badge ? (
            <span className="absolute right-[26%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium leading-none text-white tabular-nums">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
