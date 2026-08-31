import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { extractJsonLdEvents } from "@/lib/watcher/extractors/jsonld";
import { extractWithAdapter } from "@/lib/watcher/extractors/adapters";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { attachRegulationsUrl } from "@/lib/watcher/regulations-url";

export { fetchPage, type FetchResult } from "@/lib/watcher/http";

export type ExtractResult = {
  events: ParsedEvent[];
  strategy: string;
  childUrls: string[];
  confidence: number;
};

export async function extractEvents(url: string, html: string): Promise<ExtractResult> {
  const host = new URL(url).hostname.replace(/^www\./, "");

  const adapted = await extractWithAdapter(host, url, html);
  if (adapted) {
    return {
      events: attachRegulationsUrl(url, html, adapted.events),
      strategy: adapted.strategy,
      childUrls: [...new Set(adapted.events.flatMap((e) => e.childUrls ?? []))],
      confidence: adapted.events.length
        ? Math.min(...adapted.events.map((e) => e.confidence))
        : 0,
    };
  }

  const jsonld = attachRegulationsUrl(url, html, extractJsonLdEvents(url, html));
  if (jsonld.length) {
    return {
      events: jsonld,
      strategy: "jsonld",
      childUrls: [],
      confidence: Math.min(...jsonld.map((e) => e.confidence)),
    };
  }

  const generic = attachRegulationsUrl(url, html, extractGeneric(url, html));
  return {
    events: generic,
    strategy: "generic",
    childUrls: [],
    confidence: generic.length ? Math.min(...generic.map((e) => e.confidence)) : 0,
  };
}

export function stripHtmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 20000);
}

export function nextPollAt(startDate?: string | null): Date {
  const now = new Date();
  if (!startDate) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = new Date(startDate);
  const days = (start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (days < -7) return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (days <= 30) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Oct–Feb: clubs typically publish next season. Poll calendars more often then. */
export function isCalendarPublishWindow(now = new Date()): boolean {
  const m = now.getMonth();
  return m >= 9 || m <= 1;
}

export function yearInPath(url: string): number | null {
  try {
    const m = new URL(url).pathname.match(/(20\d{2})/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** `/zavody-2026/` is this year’s page or next year’s unpublished stub — don’t mark 404 dead. */
export function isPendingSeasonUrl(url: string, now = new Date()): boolean {
  const yr = yearInPath(url);
  return yr != null && yr >= now.getFullYear();
}

/**
 * Did a next-season guess actually land on next season's calendar?
 *
 * {@link nextSeasonUrl} bumps the year in the path, which works when the year
 * *is* the route and fails silently when it is decoration. `mtbs.cz/clanek/
 * jarni-bahno-2028-3-75016/...` still resolves by the id `75016`, and the site
 * answers with its current index — 150 races, every one of them from 2026. The
 * watcher then re-ingested that same list through eighteen such URLs, which is
 * most of why new rows were overwhelmingly races that had already happened.
 *
 * A guess that brings back nothing from its target season did not find that
 * season.
 */
export function seasonGuessLanded(
  url: string,
  events: { startDate: string }[],
  now = new Date(),
): boolean {
  const target = yearInPath(url);
  if (target == null || target <= now.getFullYear()) return true;
  if (!events.length) return true; // nothing yet published — keep waiting
  return events.some((e) => e.startDate.startsWith(String(target)));
}

/** `/zavody-2026/` → `/zavody-2027/` so we start watching next season before it exists. */
export function nextSeasonUrl(url: string): string | null {
  const yr = yearInPath(url);
  if (yr == null) return null;
  const y = new Date().getFullYear();
  if (yr > y + 1) return null;
  try {
    const u = new URL(url);
    // A path that also carries an opaque record id resolves by that id, so
    // bumping the year changes the address without changing the page.
    if (/\/\d{4,}(\/|$)|-\d{5,}(\/|-|$)/.test(u.pathname)) return null;
    u.pathname = u.pathname.replace(String(yr), String(yr + 1));
    return u.toString() === url ? null : u.toString();
  } catch {
    return null;
  }
}

/**
 * Poll cadence for a watched calendar.
 * Upcoming race → existing 1–7 day cadence.
 * Season over → every 3 weeks, weekly in the Oct–Feb publish window.
 */
export function sourcePollAt(
  events: { startDate: string; endDate?: string }[],
  now = new Date(),
): Date {
  const today = now.toISOString().slice(0, 10);
  const upcoming = events
    .map((e) => e.startDate)
    .filter((d) => d >= today)
    .sort();
  if (upcoming[0]) return nextPollAt(upcoming[0]);

  const last = events
    .map((e) => e.endDate || e.startDate)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (last) {
    const daysAgo = (now.getTime() - new Date(`${last}T12:00:00Z`).getTime()) / DAY_MS;
    if (daysAgo < 14) return new Date(now.getTime() + DAY_MS);
  }

  const days = isCalendarPublishWindow(now) ? 7 : 21;
  return new Date(now.getTime() + days * DAY_MS);
}

/** Backoff after errors — grows with consecutive failures, capped at 2 days. */
export function errorPollAt(consecutiveFailures = 1): Date {
  const hours = Math.min(48, Math.max(1, 2 ** Math.min(consecutiveFailures, 5)));
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** Soft review: keep active, retry in a few days instead of permanent pause. */
export function reviewPollAt(): Date {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
}
