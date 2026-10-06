"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountCommand } from "@/components/account/account-command";
import { AccountTeaser, teaserForPath } from "@/components/account/account-teaser";
import { profileNav } from "@/components/shell/nav-items";
import { useNavCounts } from "@/components/shell/use-nav-counts";
import { Badge } from "@/components/ui/badge";
import { DocPageSkeleton, PlanPageSkeleton } from "@/components/account/page-skeletons";
import { useAuthUser } from "@/hooks/use-auth-user";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/localized-paths";

/**
 * The profile's half of the frame.
 *
 * The sidebar carries the way between its pages and the account menu; this
 * decides whether to show the page at all. Somebody who is not signed in gets
 * that page's teaser instead: every one of these pages is about their own
 * races, and an empty plan with a login form under it sells nothing.
 */
export function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = messagesFor(locale);
  const pathname = usePathname() ?? "";
  const { authed } = useAuthUser();
  const counts = useNavCounts(pathname, authed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const items = profileNav(locale, t, pathname, counts, authed);

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

  return (
    <div className="flex min-h-full flex-col">
      {/* A phone has one tab for the whole profile, so its pages are here. */}
      {authed ? (
        <nav
          aria-label={t.navProfileGroup}
          className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-card px-3 md:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                item.active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {item.label}
              {item.badge ? (
                <Badge className="h-4.5 min-w-4.5 justify-center px-1 text-[11px] tabular-nums">
                  {item.badge > 99 ? "99+" : item.badge}
                </Badge>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* The plan is a working view like the list and the calendar, so it takes
          the whole sheet; the other profile pages are documents with margins. */}
      <main
        className={cn(
          "flex flex-1 flex-col",
          authed !== false && pathname === localePath(locale, `account`) ? "p-0" : "p-4 md:p-8",
        )}
      >
        {authed === null ? (
          pathname === localePath(locale, `account`) ? <PlanPageSkeleton /> : <DocPageSkeleton />
        ) : authed ? (
          children
        ) : (
          <AccountTeaser locale={locale} kind={teaserForPath(pathname)} />
        )}
      </main>

      <AccountCommand locale={locale} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
