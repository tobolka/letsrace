"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { Check } from "lucide-react";
import { TeaserArt } from "@/components/account/teasers/teaser-art";
import { Button } from "@/components/ui/button";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { teaserMessagesFor, type TeaserKey } from "@/lib/i18n/teasers";

const AuthDialog = dynamic(() =>
  import("@/components/account/auth-dialog").then((m) => ({ default: m.AuthDialog })),
);

/** Which promise a page of the profile makes to somebody who is not signed in. */
export function teaserForPath(pathname: string): TeaserKey {
  if (/\/account\/(recommendations|alerts)/.test(pathname)) return "discover";
  if (/\/account\/riders/.test(pathname)) return "riders";
  return "plan";
}

/**
 * What a page of the profile is for, shown to somebody who has not signed in.
 *
 * One centred column: the picture of the feature first, then the promise, what
 * it gets you and the one button — read top to bottom like an empty state
 * that sells, not a landing page split into halves that never lined up.
 */
export function AccountTeaser({ locale, kind }: { locale: string; kind: TeaserKey }) {
  const m = teaserMessagesFor(locale);
  const copy = m.teasers[kind];
  const [open, setOpen] = useState(false);
  const df = dateFnsLocale(locale);
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "EEEEE", { locale: df }));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center py-4 text-center md:pt-6 md:pb-12">
      <TeaserArt
        kind={kind}
        art={m.art}
        weekdays={weekdays}
        month={format(new Date(), "LLLL", { locale: df })}
      />

      {/*
        Three groups, spaced as groups: the heading block sits well clear of the
        picture, its eyebrow, title and body tight to each other; the points
        closer to the body than to the button; the button with room of its own.
      */}
      <div className="mt-12 flex max-w-lg flex-col items-center">
        <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">{copy.eyebrow}</span>
        <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">{copy.body}</p>
      </div>

      <ul className="mt-8 flex flex-col gap-3 text-left">
        {copy.points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => setOpen(true)}>
          {m.cta}
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href={`/${locale}`}>{m.browse}</Link>
        </Button>
      </div>

      {open ? (
        <AuthDialog open onClose={() => setOpen(false)} onSuccess={() => setOpen(false)} locale={locale} />
      ) : null}
    </div>
  );
}
