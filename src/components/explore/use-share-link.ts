import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { EventListItem } from "@/lib/events";
import { eventMapPath } from "@/lib/event-url";

/** Share the race's map link: the native sheet where there is one, else the clipboard (and say so for 1.8 s). */
export function useShareLink(event: EventListItem, locale: string) {
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const sharePath = eventMapPath(locale, event);

  async function copyShareLink() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: event.name, url });
        track("share_native", { slug: event.slug });
        return;
      }
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      track("share_link", { slug: event.slug });
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      /* user cancelled share or clipboard blocked */
    }
  }

  return { linkCopied, copyShareLink };
}
