import type { LucideIcon } from "lucide-react";
import { Bookmark, CalendarDays, Compass, LayoutGrid, List, Map, Settings, Users } from "lucide-react";
import type { Messages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";

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
  const at = (internal: string) => localePath(locale, internal);
  return [
    { key: "map", href: base, label: t.navMap, icon: Map, active: pathname === base },
    {
      key: "list",
      href: at("list"),
      label: t.navList,
      icon: List,
      active: pathname.startsWith(at("list")),
    },
    {
      key: "schedule",
      href: at("schedule"),
      label: t.navSchedule,
      icon: CalendarDays,
      active: pathname.startsWith(at("schedule")),
    },
    {
      // Countries, then disciplines, then series: the races for someone who
      // would rather choose than pan a map. A race's own page sits here too.
      key: "browse",
      href: at("c"),
      label: t.navBrowse,
      icon: LayoutGrid,
      active: [at("c"), `${at("e")}/`, `${at("series")}/`].some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`)),
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
  const at = (page: string) => localePath(locale, `account${page ? `/${page}` : ""}`);
  const base = at("");
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
      href: at("recommendations"),
      label: t.accountDiscover,
      icon: Compass,
      // The areas page is Discover's settings, so Discover stays lit there,
      // and new races found in those areas are Discover's news.
      active: pathname.startsWith(at("recommendations")) || pathname.startsWith(at("alerts")),
      badge: counts.alerts,
    },
    {
      key: "riders",
      href: at("riders"),
      label: t.profilesTitle,
      icon: Users,
      active: pathname.startsWith(at("riders")),
    },
    {
      key: "settings",
      href: at("settings"),
      label: t.accountSettings,
      icon: Settings,
      active: pathname.startsWith(at("settings")),
    },
  ];
  // Settings belong to an account; signed out there is nothing behind them.
  return authed === true ? items : items.filter((i) => i.key !== "settings");
}
