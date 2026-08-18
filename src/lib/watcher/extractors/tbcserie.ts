import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

function yearFromUrlOrHtml(url: string, html: string, $: cheerio.CheerioAPI): number {
  const fromUrl = url.match(/kalendar-?(20\d{2})/i);
  if (fromUrl) return Number(fromUrl[1]);
  const h = $("h2").first().text() || "";
  const m = h.match(/20\d{2}/) || html.match(/Kalendář\s*(20\d{2})/i);
  if (m) return Number(m[0].match(/20\d{2}/)?.[0] ?? m[1]);
  return new Date().getFullYear();
}

function parseDdMm(raw: string, year: number): string | null {
  const m = raw.replace(/\s+/g, " ").trim().match(/(\d{1,2})\.\s*(\d{1,2})\.?/);
  if (!m) return null;
  return `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

function parseIsoCz(raw: string): string | null {
  const m = raw.trim().match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/** Official TBC Serie calendar pages: `kalendar-YYYY` with date + place blocks. */
export function parseTbcSerieCalendar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const year = yearFromUrlOrHtml(url, html, $);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  // Each race: span.title-icon with DD. MM. near h2.title place + optional Info link
  $("span.title-icon").each((_, el) => {
    const dateText = $(el).text();
    const startDate = parseDdMm(dateText, year);
    if (!startDate) return;

    const $block = $(el).closest(".service-block, .col-md-4, .col-sm-6, .row, article, section");
    const scope = $block.length ? $block : $(el).parent().parent();
    const place =
      scope.find("h2.title").first().text().replace(/\s+/g, " ").trim() ||
      $(el).parent().find("h2.title").first().text().replace(/\s+/g, " ").trim();
    if (!place || place.length < 2) return;

    const infoHref =
      scope.find('a[href*="/zavod-"]').first().attr("href") ||
      $(el).parent().parent().find('a[href*="/zavod-"]').first().attr("href");
    let websiteUrl = "https://www.tbcserie.cz/";
    if (infoHref) {
      try {
        websiteUrl = new URL(infoHref, url).toString();
      } catch {
        /* keep series root */
      }
    }

    const externalId = `tbc-${startDate}-${normalizeName(place)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name: `TBC — ${place}`,
      startDate,
      placeText: place,
      countryHint: "CZ",
      discipline: ["cx"],
      audience: "mixed",
      seriesName: "TBC série cyklokros",
      seriesSlug: "tbc-cyclocross",
      seriesWebsite: "https://www.tbcserie.cz/",
      sourceUrl: /\/zavod-/i.test(websiteUrl) ? websiteUrl : url,
      websiteUrl,
      confidence: 0.9,
    });
  });

  return events;
}

/** Fallback: maraton.cz terminovka rows tagged “(TBC série)”. */
export function parseMaratonTbcRows(html: string, sourceUrl: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 4) return;
    const blob = cells.join(" ");
    if (!/\btbc\b/i.test(blob)) return;

    const startDate = parseIsoCz(cells[0] ?? "");
    if (!startDate) return;
    const place = cells[2] || "Jižní Čechy";
    const nameRaw = cells[3] || `TBC — ${place}`;
    const name = nameRaw.replace(/\s*\(TBC série\)\s*/i, "").trim() || `TBC — ${place}`;

    const webHref = $(tr).find('a[href*="http"]').last().attr("href");
    let websiteUrl = "https://www.tbcserie.cz/";
    if (webHref && !/maraton\.cz/i.test(webHref)) {
      try {
        const u = new URL(webHref);
        if (u.protocol === "http:") u.protocol = "https:";
        websiteUrl = u.toString();
      } catch {
        /* keep */
      }
    }

    const externalId = `tbc-maraton-${startDate}-${normalizeName(place)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name: name.startsWith("TBC") ? name : `TBC — ${name}`,
      startDate,
      placeText: place,
      countryHint: "CZ",
      discipline: ["cx"],
      audience: "mixed",
      seriesName: "TBC série cyklokros",
      seriesSlug: "tbc-cyclocross",
      seriesWebsite: "https://www.tbcserie.cz/",
      sourceUrl,
      websiteUrl,
      confidence: 0.82,
    });
  });

  return events;
}

export function discoverTbcCalendarUrls(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href*='kalendar']").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      if (/kalendar-?20\d{2}/i.test(abs)) out.add(abs.replace(/\/$/, ""));
    } catch {
      /* ignore */
    }
  });
  // Always poll current + next season path even if not linked yet
  const y = new Date().getFullYear();
  for (const yy of [y - 1, y, y + 1]) {
    out.add(`https://tbcserie.cz/kalendar-${yy}`);
  }
  return [...out];
}

export async function parseTbcSerie(url: string, html: string): Promise<ParsedEvent[]> {
  const events = parseTbcSerieCalendar(url, html);

  // Homepage / empty 2026 page: pull published TBC rows from maraton.cz
  const needsFallback =
    events.length === 0 ||
    /kalendar-?2026/i.test(url) ||
    /tbcserie\.cz\/?$/i.test(new URL(url).pathname);

  if (needsFallback) {
    try {
      const maraton = await fetchText("https://maraton.cz/terminovka");
      if (maraton.ok && maraton.text) {
        const fromMaraton = parseMaratonTbcRows(maraton.text, "https://maraton.cz/terminovka");
        const seen = new Set(events.map((e) => `${e.startDate}:${normalizeName(e.placeText)}`));
        for (const ev of fromMaraton) {
          const k = `${ev.startDate}:${normalizeName(ev.placeText)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          events.push(ev);
        }
      }
    } catch {
      /* polite fail — calendar page alone still works */
    }
  }

  const childUrls = discoverTbcCalendarUrls(html, url);
  if (childUrls.length && events.length) {
    events[0] = {
      ...events[0]!,
      childUrls: [...new Set([...(events[0]!.childUrls ?? []), ...childUrls])],
    };
  }

  return events;
}
