import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { extractJsonLdEvents } from "@/lib/watcher/extractors/jsonld";
import { extractWithAdapter } from "@/lib/watcher/extractors/adapters";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { discoverChildLinks } from "@/lib/watcher/discover";

export { fetchPage, type FetchResult } from "@/lib/watcher/http";

export type ExtractResult = {
  events: ParsedEvent[];
  strategy: string;
  childUrls: string[];
  confidence: number;
};

export async function extractEvents(url: string, html: string): Promise<ExtractResult> {
  const host = new URL(url).hostname.replace(/^www\./, "");

  const jsonld = extractJsonLdEvents(url, html);
  if (jsonld.length && jsonld.every((e) => e.confidence >= 0.7)) {
    return {
      events: jsonld,
      strategy: "jsonld",
      childUrls: discoverChildLinks(url, html),
      confidence: Math.min(...jsonld.map((e) => e.confidence)),
    };
  }

  const adapted = await extractWithAdapter(host, url, html);
  if (adapted?.events.length) {
    return {
      events: adapted.events,
      strategy: adapted.strategy,
      childUrls: [
        ...discoverChildLinks(url, html),
        ...(adapted.events.flatMap((e) => e.childUrls ?? [])),
      ],
      confidence: Math.min(...adapted.events.map((e) => e.confidence)),
    };
  }

  if (jsonld.length) {
    return {
      events: jsonld,
      strategy: "jsonld",
      childUrls: discoverChildLinks(url, html),
      confidence: Math.min(...jsonld.map((e) => e.confidence)),
    };
  }

  const generic = extractGeneric(url, html);
  return {
    events: generic,
    strategy: "generic",
    childUrls: discoverChildLinks(url, html),
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

/** Backoff after errors — grows with consecutive failures, capped at 2 days. */
export function errorPollAt(consecutiveFailures = 1): Date {
  const hours = Math.min(48, Math.max(1, 2 ** Math.min(consecutiveFailures, 5)));
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** Soft review: keep active, retry in a few days instead of permanent pause. */
export function reviewPollAt(): Date {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
}
