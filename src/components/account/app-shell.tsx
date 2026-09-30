"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountCommand } from "@/components/account/account-command";
import { AccountTeaser } from "@/components/account/account-teaser";
import { profileNav } from "@/components/shell/nav-items";
import { ShellAccountMenu } from "@/components/shell/shell-account-menu";
import { useNavCounts } from "@/components/shell/use-nav-counts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { messagesFor } from "@/lib/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/**
 * The profile's half of the frame.
 *
 * The rail carries the way between its pages; this is what is left — the
 * account menu in the corner, a row of links on a phone where the rail is not,
 * and the decision about whether to show the page at all. Someone who is not
 * signed in gets the teaser instead: every one of these pages is about their
 * own races, and an empty plan with a login form under it says little.
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
  const counts = useNavCounts(pathname);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const items = profileNav(locale, t, pathname, counts);

  useEffect(() => {
    let alive = true;
    const supabase = createBrowserSupabase();
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setAuthed(Boolean(data.user));
    });
    // Signing in from the teaser's dialog swaps the page underneath it.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setAuthed(Boolean(session?.user));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur md:px-6">
        {/* On a phone the rail is a tab bar with one tab for the profile, so
            what is inside the profile is reached from here. */}
        {authed ? (
          <nav aria-label={t.navProfileGroup} className="flex min-w-0 items-center gap-0.5 overflow-x-auto md:hidden">
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
        <div className="ml-auto">
          <ShellAccountMenu locale={locale} />
        </div>
      </header>

      <main className="flex flex-1 flex-col p-3 md:px-6 md:pt-6 md:pb-6">
        {authed === null ? (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4" aria-busy>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : authed ? (
          children
        ) : (
          <AccountTeaser locale={locale} />
        )}
      </main>

      <AccountCommand locale={locale} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
