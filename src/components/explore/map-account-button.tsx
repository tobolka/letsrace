"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarCheck, Check, LogIn, LogOut, User, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Messages } from "@/lib/i18n/messages";

/**
 * The account, and everything else behind it.
 *
 * There used to be two: a person icon on the map for the account, and a "…" in
 * the panel header for language, feedback and submitting a race. Two menus
 * means guessing which one holds the thing you want, and the "…" was the one
 * nobody opens. Maps put one control in the corner and everything under it —
 * so this is that control, clickable whether or not anyone is signed in.
 */
export function MapAccountButton({
  locale,
  messages,
  variant = "overlay",
  onSignIn,
  onSubmitRace,
  onFeedback,
}: {
  locale: string;
  messages: Messages;
  /**
   * "overlay" floats over the map and needs its own shadow; "bar" sits in the
   * account pages' top bar, where the bar already provides the surface. Same
   * control, same menu, either way — so the two halves of the app are not two
   * apps.
   */
  variant?: "overlay" | "bar";
  /** Absent where there is no sign-in dialog to open: the menu links instead. */
  onSignIn?: () => void;
  /** Absent outside the map, where these dialogs do not exist. */
  onSubmitRace?: () => void;
  onFeedback?: () => void;
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);

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
      setEmail(data.user?.email ?? null);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!alive) return;
        setAuthed(Boolean(session?.user));
        setEmail(session?.user?.email ?? null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      if (!alive) unsubscribe();
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  async function signOut() {
    const { createBrowserSupabase } = await import("@/lib/supabase/browser");
    await createBrowserSupabase().auth.signOut();
    router.refresh();
  }

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {/*
        The wide button is the one thing worth a whole button: the plan when
        you are in, the way in when you are not. It waits until auth is known —
        a "Sign in" that flips to "Our plan" a second later reads as a glitch —
        while the menu beside it is there from the first frame.
      */}
      {/* On the map this is the way into the plan. In the account's own bar the
          nav already says it, twice over. */}
      {authed === true && variant === "overlay" ? (
        <Button asChild size="sm" className="shadow-md">
          <Link href={`/${locale}/account`}>
            <CalendarCheck /> {messages.myCalendar}
          </Link>
        </Button>
      ) : null}
      {authed === false && onSignIn ? (
        <Button size="sm" onClick={onSignIn} className="shadow-md">
          <LogIn /> {messages.signIn}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={variant === "bar" ? "ghost" : "secondary"}
            aria-label={messages.account}
            className={variant === "bar" ? "rounded-full" : "rounded-full shadow-md"}
          >
            <User />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <AccountMenuItems
            authed={authed}
            email={email}
            locale={locale}
            messages={messages}
            onSignIn={onSignIn}
            onSubmitRace={onSubmitRace}
            onFeedback={onFeedback}
            onSignOut={() => void signOut()}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * The same page, in another language.
 *
 * Switching used to go to `/en` — the map back at its opening view, with the
 * dates, the filters and whatever race was open all thrown away. Only the
 * first segment of the path is the language; everything after it, and the whole
 * query string, is where you were.
 */
function useLocaleHref(): (next: string) => string {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  return (next: string) => {
    const [, first, ...rest] = pathname.split("/");
    const tail = (locales as readonly string[]).includes(first ?? "")
      ? rest.join("/")
      : [first, ...rest].filter(Boolean).join("/");
    const query = search?.toString() ?? "";
    return `/${next}${tail ? `/${tail}` : ""}${query ? `?${query}` : ""}`;
  };
}

/** The same menu wherever it is opened from — the map corner or the panel
 *  header — so there is one place to add to and nothing to keep in step. */
export function AccountMenuItems({
  authed,
  email,
  locale,
  messages,
  onSignIn,
  onSubmitRace,
  onFeedback,
  onSignOut,
}: {
  authed: boolean | null;
  email: string | null;
  locale: string;
  messages: Messages;
  onSignIn?: () => void;
  onSubmitRace?: () => void;
  onFeedback?: () => void;
  onSignOut: () => void;
}) {
  const localeHref = useLocaleHref();

  return (
    <>
      {/*
        Whose account this is. A menu that offers "Sign out" without saying who
        would be signed out is a menu you have to test to understand — and when
        nobody is signed in, saying so is what explains why the rest is short.
      */}
      {authed !== null ? (
        <>
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground">
              {authed ? messages.accountSignedIn : messages.accountSignedOut}
            </p>
            {authed && email ? (
              <p className="truncate text-sm font-medium" title={email}>
                {email}
              </p>
            ) : null}
          </div>
          <DropdownMenuSeparator />
        </>
      ) : null}

      {authed === false ? (
        <>
          <DropdownMenuGroup>
            {onSignIn ? (
              <DropdownMenuItem onSelect={onSignIn}>
                <LogIn /> {messages.signIn}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/account`}>
                  <LogIn /> {messages.signIn}
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>
      ) : null}

      {authed === true ? (
        <>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/account`}>
                <CalendarCheck /> {messages.myCalendar}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/account/alerts`}>
                <Bell /> {messages.alertTitle}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/account/settings`}>
                <UserRound /> {messages.account}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>
      ) : null}

      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {messages.language}
            <span className="ml-auto text-xs text-muted-foreground">{locale.toUpperCase()}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {locales.map((l) => (
                <DropdownMenuItem key={l} asChild>
                  <Link href={localeHref(l)} aria-current={l === locale ? "page" : undefined}>
                    <Check aria-hidden className={l === locale ? undefined : "opacity-0"} />
                    {l.toUpperCase()}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        {onSubmitRace ? (
          <DropdownMenuItem onSelect={onSubmitRace}>{messages.missingRace}</DropdownMenuItem>
        ) : null}
        {onFeedback ? (
          <DropdownMenuItem onSelect={onFeedback}>Feature / feedback…</DropdownMenuItem>
        ) : null}
      </DropdownMenuGroup>

      {authed === true ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>
            <LogOut /> {messages.signOut}
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
}
