import * as cheerio from "cheerio";
import type { Audience, Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { isNonRaceEventName } from "@/lib/event-visibility";

/** Czech month names as used on Hynek Musil series sites (talentcup, pkk-hk, mtb-biatlon, …). */
const CS_MONTHS: Record<string, string> = {
  ledna: "01",
  lednu: "01",
  unora: "02",
  unoru: "02",
  "února": "02",
  "únoru": "02",
  brezna: "03",
  breznu: "03",
  "března": "03",
  "březnu": "03",
  dubna: "04",
  dubnu: "04",
  kvetna: "05",
  kvetnu: "05",
  "května": "05",
  "květnu": "05",
  cervna: "06",
  cervnu: "06",
  "června": "06",
  "červnu": "06",
  cervence: "07",
  cervenci: "07",
  "července": "07",
  "červenci": "07",
  srpna: "08",
  srpnu: "08",
  zari: "09",
  "září": "09",
  rijna: "10",
  rijnu: "10",
  "října": "10",
  "říjnu": "10",
  listopadu: "11",
  prosince: "12",
  prosinci: "12",
};

const WEEKDAY =
  /^(pondělí|úterý|středa|čtvrtek|pátek|sobota|neděle|pondeli|utery|streda|ctvrtek|patek|sobota|nedele)(-|$|:)/i;

type SeriesMeta = {
  name: string;
  slug: string;
  audience: Audience;
  discipline: Discipline[];
  website: string;
};

const HOST_SERIES: { test: RegExp; meta: SeriesMeta }[] = [
  {
    test: /talentcup\.cz/i,
    meta: {
      name: "Talent Cup",
      slug: "talent-cup",
      audience: "kids",
      discipline: ["xco"],
      website: "https://talentcup.cz/",
    },
  },
  {
    test: /pkk-hk\.cz/i,
    meta: {
      name: "Pohár KV kraje HK",
      slug: "pohar-kv-kraje-hk",
      audience: "kids",
      discipline: ["xco"],
      website: "https://www.pkk-hk.cz/",
    },
  },
  {
    test: /mtb-biatlon\.cz/i,
    meta: {
      name: "MTB Biatlon",
      slug: "mtb-biatlon",
      audience: "mixed",
      discipline: ["other"],
      website: "https://mtb-biatlon.cz/",
    },
  },
];

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function monthNum(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return CS_MONTHS[key] || CS_MONTHS[fold(key)] || null;
}

/** "sobota: 5. září 2026" / "pátek-sobota: 25.-26.09.2026" / "neděle: 02. srpna 2026" */
function parseCzechRaceDate(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ").trim();
  // Multi-day numeric: 25.-26.09.2026 or 25. - 26. 09. 2026
  const multiNum = t.match(
    /(\d{1,2})\.\s*-?\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (multiNum) {
    const y = multiNum[4]!;
    const m = multiNum[3]!.padStart(2, "0");
    const start = `${y}-${m}-${multiNum[1]!.padStart(2, "0")}`;
    const end = `${y}-${m}-${multiNum[2]!.padStart(2, "0")}`;
    return start === end ? { start } : { start, end };
  }
  // Single numeric: 21.3.2026
  const num = t.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (num) {
    return {
      start: `${num[3]}-${num[2]!.padStart(2, "0")}-${num[1]!.padStart(2, "0")}`,
    };
  }
  // Word month: 5. září 2026
  const word = t.match(/(\d{1,2})\.\s*([A-Za-zÁ-ž]+)\s+(20\d{2})/);
  if (word) {
    const mon = monthNum(word[2]!);
    if (!mon) return null;
    return { start: `${word[3]}-${mon}-${word[1]!.padStart(2, "0")}` };
  }
  return null;
}

function placeFromTitle(name: string): string {
  const n = name.replace(/^[\s\-–—]+/, "").trim();
  // "XCO obce LITOHLAVY" / "XCO města KRALOVICE"
  const labeled = n.match(
    /^(?:xco|xc|mtb\s*biatlon)?\s*(?:obce|města|mesta)\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\wÁ-ž]*)/i,
  );
  if (labeled) return labeled[1]!;

  const parts = n.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]!;
    const last = parts[parts.length - 1]!;
    if (/^(mtb\s*biatlon|xco|xc)$/i.test(first) && parts[1]) {
      return parts[1]
        .replace(/^(obce|města|mesta)\s+/i, "")
        .replace(/\s*-\s*.*$/, "")
        .trim();
    }
    // "16. Chospílský cyklotlon - POSTŘEKOV"
    if (/^\d+\./.test(first) && last.length <= 40) return last;
    if (first.length <= 40 && !/cup|pohár|pohar|serie|seriál|uci\s*c[123]/i.test(first)) {
      return first.replace(/\s+uci.*$/i, "").trim();
    }
  }
  // "AŠ UCI C1"
  const uci = n.match(/^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\wÁ-ž]*)\s+uci\b/i);
  if (uci) return uci[1]!;
  return n.slice(0, 60);
}

function seriesForHost(url: string): SeriesMeta | null {
  try {
    const host = new URL(url).hostname;
    for (const row of HOST_SERIES) {
      if (row.test.test(host)) return row.meta;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Hynek Musil “series hub” calendars (Talent Cup, PKK HK, MTB Biatlon, …).
 * Rows look like: `sobota: 5. září 2026` | `Aš - ANTAL BIKE`
 */
export function parseHynekSeriesCalendar(url: string, html: string): ParsedEvent[] {
  const series = seriesForHost(url);
  if (!series) return [];

  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("td").each((_, el) => {
    const dateText = $(el).text().replace(/\s+/g, " ").trim();
    if (!WEEKDAY.test(dateText) || !/20\d{2}/.test(dateText)) return;
    const dates = parseCzechRaceDate(dateText);
    if (!dates) return;

    // Title is usually the next sibling cell(s) in the same row
    const $row = $(el).closest("tr");
    const cells = $row
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    const nameCell =
      cells.find(
        (c) =>
          c !== dateText &&
          !WEEKDAY.test(c) &&
          !/^(on-line|výsledky|vysledky|propozice|plakát|plakat|trasy)$/i.test(c) &&
          c.length >= 4 &&
          c.length < 160,
      ) || "";
    if (!nameCell) return;
    if (/článek|clanek|pozvánka|pozvanka|stránky převedeny/i.test(nameCell)) return;

    const name = nameCell.replace(/\s+/g, " ").trim();
    if (isNonRaceEventName(name)) return;
    const externalId = `${series.slug}-${dates.start}-${normalizeName(name)}`.slice(0, 120);
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const regHref = $row
      .find("a[href*='registry'], a[href*='register'], a[title*='REGISTRACE' i]")
      .first()
      .attr("href");
    let registrationUrl: string | undefined;
    if (regHref && /^https?:/i.test(regHref)) registrationUrl = regHref;

    const raceHref = $row
      .find("a[href*='.pdf'], a[href*='propozice'], a[title*='PROPOZICE' i]")
      .first()
      .attr("href");
    let websiteUrl = series.website;
    let regulationsUrl: string | undefined;
    if (raceHref) {
      try {
        const abs = new URL(raceHref, url).toString();
        if (/\.pdf(\?|#|$)/i.test(abs) || /propozic/i.test(abs)) regulationsUrl = abs;
        else websiteUrl = abs;
      } catch {
        /* keep series site */
      }
    }

    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end,
      placeText: placeFromTitle(name),
      countryHint: "CZ",
      discipline: series.discipline,
      audience: series.audience,
      seriesName: series.name,
      seriesSlug: series.slug,
      seriesWebsite: series.website,
      sourceUrl: websiteUrl !== series.website ? websiteUrl : `${url}#${dates.start}`,
      websiteUrl,
      registrationUrl,
      regulationsUrl,
      confidence: 0.88,
    });
  });

  return events;
}

export function isHynekSeriesCalendarHost(host: string): boolean {
  return HOST_SERIES.some((r) => r.test.test(host));
}
