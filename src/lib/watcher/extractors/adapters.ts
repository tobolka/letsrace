import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { parseCscCalendar } from "@/lib/watcher/extractors/csc";
import { parseSumator } from "@/lib/watcher/extractors/sumator";
import { parseMtbs } from "@/lib/watcher/extractors/mtbs";
import { parseHynekMusil } from "@/lib/watcher/extractors/hynek";
import { parseFederciclismo } from "@/lib/watcher/extractors/federciclismo";
import { parseVelokal } from "@/lib/watcher/extractors/velokal";
import { parseRadsportEvents } from "@/lib/watcher/extractors/radsport";
import { parseEventiv } from "@/lib/watcher/extractors/eventiv";
import * as cheerio from "cheerio";

type AdapterResult = { events: ParsedEvent[]; strategy: string };

export async function extractWithAdapter(
  host: string,
  url: string,
  html: string,
): Promise<AdapterResult | null> {
  if (host.includes("juniorcup.net")) {
    return { events: parseJuniorCup(url, html), strategy: "adapter:juniorcup" };
  }
  if (host.includes("sumator.cz")) {
    return { events: await parseSumator(url, html), strategy: "adapter:sumator" };
  }
  if (host.includes("kolopro.cz")) {
    return { events: parseKolopro(url, html), strategy: "adapter:kolopro" };
  }
  if (
    host.includes("ceskysvazcyklistiky.cz") ||
    host.includes("czechcyclingfederation.com")
  ) {
    return { events: parseCscCalendar(url, html), strategy: "adapter:csc" };
  }
  if (host.includes("mtbs.cz")) {
    return { events: await parseMtbs(url, html), strategy: "adapter:mtbs" };
  }
  if (host.includes("hynekmusil.cz")) {
    const events = parseHynekMusil(url, html);
    const { discoverHynekSeriesUrls } = await import("@/lib/watcher/extractors/hynek");
    const seriesUrls = discoverHynekSeriesUrls(html);
    if (seriesUrls.length && events[0]) {
      events[0] = {
        ...events[0],
        childUrls: [...new Set([...(events[0].childUrls ?? []), ...seriesUrls])],
      };
    }
    return { events, strategy: "adapter:hynek" };
  }
  if (host.includes("federciclismo.it")) {
    return { events: await parseFederciclismo(url, html), strategy: "adapter:fci" };
  }
  if (host.includes("velokal.de")) {
    return { events: parseVelokal(url, html), strategy: "adapter:velokal" };
  }
  if (host.includes("radsport-events.de")) {
    return { events: await parseRadsportEvents(url, html), strategy: "adapter:radsport" };
  }
  if (host.includes("eventivsport.com")) {
    return { events: await parseEventiv(url, html), strategy: "adapter:eventiv" };
  }
  return null;
}

function parseJuniorCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const dateMatch = text.match(/(\d{1,2})\.\s*([a-zá-ž]+)\s+(\d{4})/i);
  const placeMatch = text.match(/Hradec\s+Králové[^,]*/i);
  const months: Record<string, string> = {
    ledna: "01",
    února: "02",
    března: "03",
    dubna: "04",
    května: "05",
    června: "06",
    července: "07",
    srpna: "08",
    září: "09",
    října: "10",
    listopadu: "11",
    prosince: "12",
  };
  let startDate = "";
  if (dateMatch) {
    const m = months[dateMatch[2].toLowerCase()];
    if (m) {
      startDate = `${dateMatch[3]}-${m}-${dateMatch[1].padStart(2, "0")}`;
    }
  }
  if (!startDate) return [];
  return [
    {
      externalId: `juniorcup-${startDate}`,
      name: "Junior Cup",
      startDate,
      placeText: placeMatch?.[0] ?? "Hradec Králové",
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "kids",
      categories: [
        { name: "200 m", distanceKm: 0.2, ageMin: 4, ageMax: 6 },
        { name: "1 km", distanceKm: 1, ageMin: 7, ageMax: 10 },
        { name: "2.2 km", distanceKm: 2.2, ageMin: 11, ageMax: 14 },
      ],
      sourceUrl: url,
      confidence: 0.9,
    },
  ];
}

function parseKolopro(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  $("h2, h3, a").each((_, el) => {
    const name = $(el).text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 8 || name.length > 100) return;
    if (!/tour|maraton|trophy|mlýnice|ralsko|železné|znojmo/i.test(name)) return;
    events.push({
      externalId: `kolopro-${normalizeName(name)}`,
      name,
      startDate: "2026-05-01",
      placeText: name,
      countryHint: "CZ",
      discipline: ["xcm"],
      audience: "mixed",
      sourceUrl: url,
      confidence: 0.45,
    });
  });
  return dedupe(events).slice(0, 20);
}

function dedupe(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = `${e.startDate}:${normalizeName(e.name)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
