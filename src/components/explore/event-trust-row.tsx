"use client";

import { Maximize2, Share } from "lucide-react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { SaveRaceButton } from "@/components/race/save-race-button";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { eventPagePath } from "@/lib/event-url";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/** The card's footer: how far to trust the data, when it was checked, and the open / save / share buttons. */
export function EventTrustRow({
  event,
  locale,
  trustLow,
  trustText,
  checkedText,
  linkCopied,
  onShare,
}: {
  event: EventListItem;
  locale: string;
  trustLow: boolean;
  /** Only set for the weaker trust levels; the strong ones say nothing. */
  trustText: string | null;
  checkedText: string | null;
  linkCopied: boolean;
  onShare: () => void;
}) {
  const t = messagesFor(locale);
  const showTrustLabel = trustText != null;
  return (
    <div className="flex w-full min-w-0 items-center gap-2 px-1" title={t.trustExplanation}>
      <p className="sr-only" aria-live="polite">
        {linkCopied ? t.linkCopied : ""}
      </p>
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-xs leading-snug",
          trustLow ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {trustText}
        {checkedText && event.lastSeenAt ? (
          <>
            {showTrustLabel ? <span aria-hidden> · </span> : null}
            <time className="tabular-nums" dateTime={event.lastSeenAt}>
              {checkedText}
            </time>
          </>
        ) : null}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {/* The card is the short version; the race's own page has all of it. */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-9 [@media(pointer:coarse)]:size-11"
          tooltip={t.openRaceDetail}
        >
          <Link
            href={eventPagePath(locale, event.slug)}
            aria-label={t.openRaceDetail}
            onClick={() => track("cta_click", { slug: event.slug, location: "race_panel", source: "full_detail" })}
          >
            <Maximize2 />
          </Link>
        </Button>
        <SaveRaceButton
          eventId={event.id}
          raceName={event.name}
          locale={locale}
          className="size-9 [@media(pointer:coarse)]:size-11"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={linkCopied}
              size="lg"
              aria-label={linkCopied ? t.linkCopied : t.shareRace}
              className="size-9 min-w-9 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              onPressedChange={() => {
                if (!linkCopied) onShare();
              }}
            >
              <Share />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{linkCopied ? t.linkCopied : t.shareRace}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
