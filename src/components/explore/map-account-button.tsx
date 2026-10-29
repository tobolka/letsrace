"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Flag, Info, Languages, LogIn, LogOut, MessageSquare } from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale, type Messages } from "@/lib/i18n/messages";
import { rememberLocale } from "@/lib/i18n/locale-preference";
import { translatePathname, localePath } from "@/lib/localized-paths";

export async function signOutAndRefresh(router: ReturnType<typeof useRouter>) {
  const { createBrowserSupabase } = await import("@/lib/supabase/browser");
  await createBrowserSupabase().auth.signOut();
  router.refresh();
}

/**
 * The same page, in another language.
 *
 * The language prefix and the translated section names change; the rest of
 * the path, and the whole query string, is where you were.
 */
function useLocaleHref(): (next: string) => string {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  return (next: string) => {
    // Section names are translated too (`zavod` → `race`), not only the prefix.
    const query = search?.toString() ?? "";
    return `${translatePathname(pathname, next as Locale)}${query ? `?${query}` : ""}`;
  };
}

/**
 * What is left for the account menu once the navigation carries the pages.
 *
 * The plan, discovery, riders and settings each have their own place in the
 * sidebar, so repeating them here only made two ways to the same door. The
 * menu keeps what has nowhere else to live: who is signed in, the language,
 * the two ways to write to us, and the way out.
 */
export function AccountMenuItems({
  authed,
  email,
  locale,
  messages,
  onSignIn,
  onSubmitRace,
  onFeedback,
  onSignOut,
  showAbout = true,
}: {
  authed: boolean | null;
  email: string | null;
  locale: string;
  messages: Messages;
  /** Off where the about page already has its own icon next to the menu. */
  showAbout?: boolean;
  onSignIn?: () => void;
  onSubmitRace?: () => void;
  onFeedback?: () => void;
  onSignOut: () => void;
}) {
  const localeHref = useLocaleHref();

  return (
    <>
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
                <Link href={localePath(locale, `account`)}>
                  <LogIn /> {messages.signIn}
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>
      ) : null}

      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages aria-hidden />
            {messages.language}
            <span className="ml-auto text-xs text-muted-foreground">{locale.toUpperCase()}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {locales.map((l) => (
                <DropdownMenuItem key={l} asChild>
                  <Link href={localeHref(l)} onClick={() => rememberLocale(l)} aria-current={l === locale ? "page" : undefined}>
                    <Check aria-hidden className={l === locale ? undefined : "opacity-0"} />
                    {l.toUpperCase()}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        {onSubmitRace ? (
          <DropdownMenuItem onSelect={onSubmitRace}>
            <Flag aria-hidden /> {messages.missingRace}
          </DropdownMenuItem>
        ) : null}
        {onFeedback ? (
          <DropdownMenuItem onSelect={onFeedback}>
            <MessageSquare aria-hidden /> Feature / feedback…
          </DropdownMenuItem>
        ) : null}
        {/* Who makes the site and where its races come from. */}
        {showAbout ? (
          <DropdownMenuItem asChild>
            <Link href={localePath(locale, "about")}>
              <Info aria-hidden /> {messages.navAbout}
            </Link>
          </DropdownMenuItem>
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
