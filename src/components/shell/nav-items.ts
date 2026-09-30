import type { LucideIcon } from "lucide-react";
import { Bookmark, CalendarDays, Compass, List, Map, Settings, Users } from "lucide-react";
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
  ];
}

/** Everything that lives behind the profile. */
export function profileNav(
  locale: string,
  t: Messages,
  pathname: string,
  counts: { action: number; alerts: number },
): NavItem[] {
  const base = `/${locale}/account`;
  return [
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
}
