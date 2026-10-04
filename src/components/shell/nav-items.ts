import type { LucideIcon } from "lucide-react";
import { Bookmark, CalendarDays, Compass, LayoutGrid, List, Map, Settings, Users } from "lucide-react";
import type { Messages } from "@/lib/i18n/messages";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** Outstanding things to do behind this item; shown as a badge. */
  badge?: number;
};

/**
 * The three ways of looking at the races. Links between them carry the filters
 * along when clicked (`useCarryFilters`).
 */
export function exploreNav(locale: string, t: Messages, pathname: string): NavItem[] {
  const base = `/${locale}`;
  return [
    { key: "map", href: base, label: t.navMap, icon: Map, active: pathname === base },
    {
      key: "list",
      href: `${base}/list`,
      label: t.navList,
      icon: List,
      active: pathname.startsWith(`${base}/list`),
    },
    {
      key: "schedule",
      href: `${base}/schedule`,
      label: t.navSchedule,
      icon: CalendarDays,
      active: pathname.startsWith(`${base}/schedule`),
    },
    {
      // Countries, then disciplines, then series: the races for someone who
      // would rather choose than pan a map. A race's own page sits here too.
      key: "browse",
      href: `${base}/c`,
      label: t.navBrowse,
      icon: LayoutGrid,
      active: [`${base}/c`, `${base}/e/`, `${base}/series/`].some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`)),
    },
  ];
}

/** Everything that lives behind the profile. */
export function profileNav(
  locale: string,
  t: Messages,
  pathname: string,
  counts: { action: number; alerts: number },
  authed: boolean | null,
): NavItem[] {
  const base = `/${locale}/account`;
  const items: NavItem[] = [
    {
      key: "plan",
      href: base,
      label: t.myCalendar,
      icon: Bookmark,
      // The plan has no path fragment of its own — every other page lives under
      // it — so it is active on an exact match and nothing else.
      active: pathname === base,
      badge: counts.action,
    },
    {
      key: "discover",
      href: `${base}/recommendations`,
      label: t.accountDiscover,
      icon: Compass,
      // The areas page is Discover's settings, so Discover stays lit there,
      // and new races found in those areas are Discover's news.
      active: pathname.startsWith(`${base}/recommendations`) || pathname.startsWith(`${base}/alerts`),
      badge: counts.alerts,
    },
    {
      key: "riders",
      href: `${base}/riders`,
      label: t.profilesTitle,
      icon: Users,
      active: pathname.startsWith(`${base}/riders`),
    },
    {
      key: "settings",
      href: `${base}/settings`,
      label: t.accountSettings,
      icon: Settings,
      active: pathname.startsWith(`${base}/settings`),
    },
  ];
  // Settings belong to an account; signed out there is nothing behind them.
  return authed === true ? items : items.filter((i) => i.key !== "settings");
}
