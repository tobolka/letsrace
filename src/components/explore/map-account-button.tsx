"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The account, where someone would look for it.
 *
 * Signing in and "Our plan" — the whole reason this is more than a calendar —
 * lived behind a "…" in the sidebar header. Nothing on the map suggested an
 * account existed at all. This sits in the map's top-right corner, which is
 * where every map app puts it, and changes to the plan link once you are in.
 */
export function MapAccountButton({
  locale,
  messages,
  onSignIn,
}: {
  locale: string;
  messages: { signIn: string; myCalendar: string; account: string };
  onSignIn: () => void;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    // The auth client is a quarter of a megabyte and nothing on screen needs it
    // until we know who is signed in, so it is fetched after the page is up
    // rather than shipped with it.
    void (async () => {
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      if (!alive) return;
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setAuthed(Boolean(data.user));
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (alive) setAuthed(Boolean(session?.user));
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      if (!alive) unsubscribe();
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  // Render nothing until we know — a "Sign in" that flips to "Our plan" on load
  // reads as a glitch.
  if (authed === null) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {authed ? (
        <>
          <Button asChild size="sm" className="shadow-md">
            <Link href={`/${locale}/calendar`}>
              <CalendarCheck /> {messages.myCalendar}
            </Link>
          </Button>
          <Button asChild size="icon" variant="secondary" className="rounded-full shadow-md">
            <Link href={`/${locale}/account`} aria-label={messages.account}>
              <User />
            </Link>
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={onSignIn} className="shadow-md">
          <LogIn /> {messages.signIn}
        </Button>
      )}
    </div>
  );
}
