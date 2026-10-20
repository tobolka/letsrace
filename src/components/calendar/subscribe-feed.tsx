"use client";

import { useState } from "react";
import { CalendarPlus, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { messagesFor } from "@/lib/i18n/messages";

export type FeedFilters = {
  q: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  country: string[];
};

/** The feed's address for these filters; dates stay out so it keeps rolling. */
export function feedPath(locale: string, f: FeedFilters): string {
  const params = new URLSearchParams({ lang: locale });
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.series) params.set("series", f.series);
  if (f.country.length) params.set("country", f.country.join(","));
  if (f.disciplines.length) params.set("disciplines", f.disciplines.join(","));
  if (f.levels.length) params.set("levels", f.levels.join(","));
  if (f.categories.length) params.set("categories", f.categories.join(","));
  return `/api/races.ics?${params}`;
}

/**
 * The calendar's filters as a subscription in the rider's own calendar app.
 *
 * Subscribing, not downloading: a downloaded file is a snapshot, and the point
 * is that a race added next week turns up without anyone coming back here.
 */
export function SubscribeFeed({ locale, filters }: { locale: string; filters: FeedFilters }) {
  const t = messagesFor(locale);
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}${feedPath(locale, filters)}`;
  const webcal = url.replace(/^https?:/, "webcal:");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.feedCopy);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 [@media(pointer:coarse)]:h-11">
          <CalendarPlus />
          <span className="max-sm:sr-only">{t.subscribeFeed}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3" collisionPadding={12}>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{t.subscribeFeedTitle}</p>
          <p className="text-sm text-muted-foreground">{t.subscribeFeedBody}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={webcal}>{t.feedApple}</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.feedGoogle}
            </a>
          </Button>
        </div>
        <InputGroup>
          <InputGroupInput readOnly value={url} aria-label={t.subscribeFeedTitle} onFocus={(e) => e.currentTarget.select()} />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="button" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? t.feedCopied : t.feedCopy}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PopoverContent>
    </Popover>
  );
}
