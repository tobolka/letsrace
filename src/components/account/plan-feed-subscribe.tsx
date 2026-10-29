"use client";

import { CalendarPlus } from "lucide-react";
import { CalendarFeed } from "@/components/account/calendar-feed";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { messagesFor } from "@/lib/i18n/messages";

/** The plan's own feed, the same link as in settings, one tap from the calendar. */
export function PlanFeedSubscribe({ locale, userId }: { locale: string; userId: string }) {
  const t = messagesFor(locale);
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
          <p className="text-sm font-semibold">{t.feedTitle}</p>
          <p className="text-sm text-muted-foreground">{t.feedBody}</p>
        </div>
        <CalendarFeed locale={locale} userId={userId} bare />
      </PopoverContent>
    </Popover>
  );
}
