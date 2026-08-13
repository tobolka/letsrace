import { createHash } from "crypto";
import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { extractJsonLdEvents } from "@/lib/watcher/extractors/jsonld";
import { extractWithAdapter } from "@/lib/watcher/extractors/adapters";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { discoverChildLinks } from "@/lib/watcher/discover";

export type FetchResult = {
  html: string;
  status: number;
  etag?: string | null;
  lastModified?: string | null;
  hash: string;
  unchanged: boolean;
};

export async function fetchPage(
  url: string,
  opts?: { etag?: string | null; lastModified?: string | null; contentHash?: string | null },
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    "User-Agent": "StartlineBot/0.1 (+https://startline.app; race calendar aggregator)",
    Accept: "text/html,application/xhtml+xml",
  };
  if (opts?.etag) headers["If-None-Match"] = opts.etag;
  if (opts?.lastModified) headers["If-Modified-Since"] = opts.lastModified;

  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (res.status === 304) {
    return {
      html: "",
      status: 304,
      etag: opts?.etag,
      lastModified: opts?.lastModified,
      hash: opts?.contentHash ?? "",
      unchanged: true,
    };
  }

  const html = await res.text();
  const hash = createHash("sha256").update(html).digest("hex");
  return {
    html,
    status: res.status,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    hash,
    unchanged: Boolean(opts?.contentHash && opts.contentHash === hash),
  };
}

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
