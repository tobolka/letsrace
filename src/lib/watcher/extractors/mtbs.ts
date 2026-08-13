import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { inferRaceLevel } from "@/lib/race-level";

const DISC_MAP: Record<string, Discipline> = {
  xc: "xco",
  xco: "xco",
  xcm: "xcm",
  silnice: "road",
  dh: "dh",
  enduro: "enduro",
  gravel: "gravel",
  gravelk: "gravel",
  mtbo: "other",
  cyklokros: "cx",
  akce: "other",
  freestyle: "other",
  trial: "other",
  "4x": "other",
};

function parseCzDate(text: string): { start: string; end?: string } | null {
  // 15. 08. 2026  or  23. 08. 2026 - 28. 08. 2026
  const range = text.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/,
  );
  if (range) {
    return {
      start: `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`,
      end: `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`,
    };
  }
  const single = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!single) return null;
  return {
    start: `${single[3]}-${single[2].padStart(2, "0")}-${single[1].padStart(2, "0")}`,
  };
}

function absUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("www.")) return `https://${href}`;
  if (href.startsWith("/")) return `https://mtbs.cz${href}`;
  return undefined;
}

function parseCards(html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];

  $(".card-calendar").each((_, el) => {
    const $card = $(el);
    const dateText = $card.find("h3").first().text().replace(/\s+/g, " ").trim();
    const dates = parseCzDate(dateText);
    if (!dates) return;

    const lis = $card.find(".card-calendar__info__top ul li a");
    const discRaw = lis.eq(0).text().replace(/\s+/g, " ").trim();
    const place = lis.eq(1).text().replace(/\s+/g, " ").trim() || "Czechia";
    const name = lis.eq(2).text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;

    const articleHref = lis.eq(2).attr("href") || lis.eq(1).attr("href");
    const webHref = $card
      .find('.a-badge:contains("Web"), a.a-badge')
      .filter((_, a) => /web/i.test($(a).text()))
      .first()
      .attr("href");
    const regHref = $card
      .find("a.a-badge")
      .filter((_, a) => /registrace/i.test($(a).text()))
      .first()
      .attr("href");

    const sourceUrl =
      absUrl(webHref) ||
      (articleHref?.startsWith("/") ? `https://mtbs.cz${articleHref}` : absUrl(articleHref)) ||
      "https://mtbs.cz/sekce/kalendar";

    const disc = DISC_MAP[discRaw.toLowerCase()];
    const level = inferRaceLevel(`${name} ${discRaw}`);
    const audience: ParsedEvent["audience"] =
      /junior|žák|děti|deti|kids|kemp/i.test(name) ? "kids" : "mixed";

    events.push({
      externalId: `mtbs-${normalizeName(name)}-${dates.start}`,
      name,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place.slice(0, 100),
      countryHint: /slovensko|slovakia|\bsk\b/i.test(place) ? "SK" : "CZ",
      discipline: disc ? [disc] : undefined,
      audience,
      sourceUrl,
      registrationUrl: absUrl(regHref),
      confidence: 0.88,
      childUrls: articleHref?.startsWith("/") ? [`https://mtbs.cz${articleHref}`] : undefined,
    });
    void level;
  });

  return events;
}

async function fetchMtbsPage(offset: number, dates: string): Promise<string> {
  const body = new URLSearchParams({
    catid: "0",
    offset: String(offset),
    dates,
  });
  const res = await fetch("https://mtbs.cz/ajax/loadkalendar.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "StartlineBot/0.1 (+https://startline.app; race calendar aggregator)",
      Accept: "text/html",
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return "";
  return res.text();
}

/** Parse MTBS calendar page + paginate via /ajax/loadkalendar.php */
export async function parseMtbs(url: string, html: string): Promise<ParsedEvent[]> {
  const events = parseCards(html);

  // Paginate for full season (server-rendered page is only ~20 items)
  const year = new Date().getFullYear();
  const dates = `01.03.${year} - 31.12.${year}`;
  const maxPages = 8; // 8 * 20 = 160
  for (let page = 0; page < maxPages; page++) {
    const offset = page * 20;
    // Skip offset 0 if we already parsed the HTML body (same window)
    if (page === 0 && events.length >= 15) continue;
    try {
      const chunk = await fetchMtbsPage(offset, dates);
      if (!chunk) break;
      const more = parseCards(chunk);
      if (!more.length) break;
      events.push(...more);
      if (more.length < 10) break;
    } catch {
      break;
    }
  }

  return dedupe(events).slice(0, 200);
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
