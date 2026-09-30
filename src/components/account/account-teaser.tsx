"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format, startOfWeek, addDays } from "date-fns";
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
 * Each page gets its own: the plan sells the season, discovery sells the
 * alerts, riders sells the family. A bare sign-in form answers "what is this?"
 * with "give us your email"; this answers the question first and leaves the
 * form one button away.
 */
export function AccountTeaser({ locale, kind }: { locale: string; kind: TeaserKey }) {
  const m = teaserMessagesFor(locale);
  const copy = m.teasers[kind];
  const [open, setOpen] = useState(false);
  const df = dateFnsLocale(locale);
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "EEEEE", { locale: df }));

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-6 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
      <div className="flex max-w-xl flex-col gap-6">
        <span className="w-fit rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          {copy.eyebrow}
        </span>
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-[2.75rem] md:leading-[1.05]">
            {copy.title}
          </h1>
          <p className="text-base text-pretty text-muted-foreground md:text-lg">{copy.body}</p>
        </div>
        <ul className="flex flex-col gap-3">
          {copy.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => setOpen(true)}>
              {m.cta}
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href={`/${locale}`}>{m.browse}</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{m.ctaNote}</p>
        </div>
      </div>

      <TeaserArt
        kind={kind}
        art={m.art}
        weekdays={weekdays}
        month={format(new Date(), "LLLL", { locale: df })}
      />

      {open ? (
        <AuthDialog open onClose={() => setOpen(false)} onSuccess={() => setOpen(false)} locale={locale} />
      ) : null}
    </div>
  );
}
