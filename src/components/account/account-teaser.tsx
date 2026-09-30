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
 * The picture of the feature beside the promise, what it gets you and the one
 * button.
 */
export function AccountTeaser({ locale, kind }: { locale: string; kind: TeaserKey }) {
  const m = teaserMessagesFor(locale);
  const copy = m.teasers[kind];
  const [open, setOpen] = useState(false);
  const df = dateFnsLocale(locale);
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "EEEEE", { locale: df }));

  return (
    // The picture on the left, the promise on the right, centred on each
    // other and in the page — a touch above true centre, where the eye puts
    // it (the extra padding underneath). On a phone the picture stacks on top.
    <div className="m-auto grid w-full max-w-5xl items-center gap-10 py-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-14 md:pt-6 md:pb-16">
      <TeaserArt
        kind={kind}
        art={m.art}
        weekdays={weekdays}
        month={format(new Date(), "LLLL", { locale: df })}
      />

      {/*
        Three groups, spaced as groups: eyebrow, title and body tight to each
        other; the points closer to the body than to the button; the button
        with room of its own.
      */}
      <div className="flex flex-col items-start">
        <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">{copy.eyebrow}</span>
        <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">{copy.body}</p>

        <ul className="mt-8 flex flex-col gap-3">
          {copy.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => setOpen(true)}>
            {m.cta}
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href={`/${locale}`}>{m.browse}</Link>
          </Button>
        </div>
      </div>

      {open ? (
        <AuthDialog open onClose={() => setOpen(false)} onSuccess={() => setOpen(false)} locale={locale} />
      ) : null}
    </div>
  );
}
