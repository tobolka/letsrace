"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, CirclePlus, Info, LogIn, LogOut, MessageSquare, X } from "lucide-react";
import { signOutAndRefresh } from "@/components/explore/map-account-button";
import { MODAL_SURFACE } from "@/components/explore/mobile-sheets";
import { profileNav } from "@/components/shell/nav-items";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer";
import { locales, messagesFor, type Locale } from "@/lib/i18n/messages";
import { rememberLocale } from "@/lib/i18n/locale-preference";
import { localePath, translatePathname } from "@/lib/localized-paths";
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

const row =
  "flex h-12 w-full min-w-0 items-center gap-3 px-4 text-left text-[15px] transition-colors active:bg-accent [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground";

/**
 * Everything on a phone that is not one of the four race views, behind the
 * last tab.
 *
 * The account used to be in two places at once — a person icon floating over
 * the map's corner and a profile tab at the bottom — each opening half of
 * what is yours. This is the one door: your pages, signing in and out, adding
 * a race, writing to us, who we are and the language.
 */
export function MoreSheet({
  open,
  onOpenChange,
  locale,
  authed,
  email,
  counts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  authed: boolean | null;
  email: string | null;
  counts: { action: number; alerts: number };
}) {
  const t = messagesFor(locale);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [dialog, setDialog] = useState<"auth" | "submit" | "feedback" | null>(null);
  const pages = profileNav(locale, t, pathname, counts, authed);
  const aboutHref = localePath(locale, "about");

  function openDialog(next: "auth" | "submit" | "feedback") {
    onOpenChange(false);
    setDialog(next);
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} noBodyStyles repositionInputs={false}>
        <DrawerContent className={cn(MODAL_SURFACE, "flex flex-col")}>
          <DrawerHandle />
          <div className="flex items-center justify-between gap-3 px-4 pb-1">
            <DrawerTitle className="text-left text-base font-semibold">{t.moreTitle}</DrawerTitle>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="-mr-2 size-11 rounded-full" aria-label={t.close}>
                <X className="size-4" aria-hidden />
              </Button>
            </DrawerClose>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            <section aria-label={t.moreAccount}>
              <div className="px-4 pt-1 pb-2">
                <p className="text-xs text-muted-foreground">{authed ? t.accountSignedIn : t.accountSignedOut}</p>
                {authed && email ? (
                  <p className="truncate text-sm font-medium" title={email}>
                    {email}
                  </p>
                ) : null}
              </div>
              {authed === false ? (
                <div className="px-4 pb-2">
                  <Button type="button" size="lg" className="h-11 w-full" onClick={() => openDialog("auth")}>
                    <LogIn data-icon="inline-start" />
                    {t.signIn}
                  </Button>
                </div>
              ) : null}
              <ul className="border-y">
                {pages.map((item) => (
                  <li key={item.key} className="border-b last:border-b-0">
                    <Link
                      href={item.href}
                      aria-current={item.active ? "page" : undefined}
                      onClick={() => onOpenChange(false)}
                      className={cn(row, item.active && "font-semibold text-brand [&>svg]:text-brand")}
                    >
                      <item.icon aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white tabular-nums">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                      <ChevronRight className="size-4! text-muted-foreground/60" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label={t.moreApp} className="mt-3">
              <ul className="border-y">
                <li className="border-b">
                  <button type="button" className={row} onClick={() => openDialog("submit")}>
                    <CirclePlus aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{t.missingRace}</span>
                  </button>
                </li>
                <li className="border-b">
                  <button type="button" className={row} onClick={() => openDialog("feedback")}>
                    <MessageSquare aria-hidden />
                    <span className="min-w-0 flex-1 truncate">Feature / feedback…</span>
                  </button>
                </li>
                <li>
                  <Link href={aboutHref} onClick={() => onOpenChange(false)} className={row}>
                    <Info aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{t.navAbout}</span>
                    <ChevronRight className="size-4! text-muted-foreground/60" aria-hidden />
                  </Link>
                </li>
              </ul>
            </section>

            <section className="mt-4 px-4">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.language}</h3>
              <div className="flex flex-wrap gap-2">
                {locales.map((l) => (
                  <Button
                    key={l}
                    type="button"
                    variant={l === locale ? "default" : "outline"}
                    className="h-10 min-w-12 rounded-full"
                    aria-current={l === locale ? "true" : undefined}
                    onClick={() => {
                      rememberLocale(l);
                      onOpenChange(false);
                      if (l === locale) return;
                      // The same page in the other language, query and all.
                      router.push(`${translatePathname(window.location.pathname, l as Locale)}${window.location.search}`);
                    }}
                  >
                    {l.toUpperCase()}
                  </Button>
                ))}
              </div>
            </section>

            {authed ? (
              <div className="mt-4 border-t">
                <button
                  type="button"
                  className={cn(row, "text-destructive [&>svg]:text-destructive")}
                  onClick={() => {
                    onOpenChange(false);
                    void signOutAndRefresh(router);
                  }}
                >
                  <LogOut aria-hidden />
                  <span>{t.signOut}</span>
                </button>
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      {dialog === "submit" ? <SubmitRaceModal open onClose={() => setDialog(null)} messages={t} /> : null}
      {dialog === "feedback" ? <FeedbackModal open onClose={() => setDialog(null)} /> : null}
      {dialog === "auth" ? (
        <AuthDialog open onClose={() => setDialog(null)} onSuccess={() => setDialog(null)} locale={locale} />
      ) : null}
    </>
  );
}
