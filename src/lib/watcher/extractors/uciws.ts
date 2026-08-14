import type { Discipline, ParsedEvent } from "@/lib/domain";

const EN_MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const COUNTRY: Record<string, string> = {
  "czech republic": "CZ",
  austria: "AT",
  switzerland: "CH",
  france: "FR",
  italy: "IT",
  andorra: "AD",
  germany: "DE",
  "united kingdom": "GB",
  scotland: "GB",
  "great britain": "GB",
  portugal: "PT",
  poland: "PL",
  slovenia: "SI",
  denmark: "DK",
  netherlands: "NL",
  "the netherlands": "NL",
  belgium: "BE",
  spain: "ES",
  "south korea": "KR",
  korea: "KR",
  "united states": "US",
  usa: "US",
  canada: "CA",
};

const DATE_RE =
  /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{2,4})\b/gi;

function parseUciDate(raw: string): { start: string; end?: string } | null {
  DATE_RE.lastIndex = 0;
  const m = DATE_RE.exec(raw.replace(/\s+/g, " "));
  if (!m) return null;
  const mon = EN_MONTHS[m[3]!.toLowerCase()];
  if (!mon) return null;
  let year = m[4]!;
  if (year.length === 2) year = `20${year}`;
  const start = `${year}-${mon}-${m[1]!.padStart(2, "0")}`;
  const endDay = m[2] || m[1]!;
  const end = `${year}-${mon}-${endDay.padStart(2, "0")}`;
  return { start, end: end !== start ? end : undefined };
}

function mapDisc(blob: string): Discipline[] {
  const t = blob.toLowerCase();
  const out: Discipline[] = [];
  if (/downhill/.test(t)) out.push("dh");
  if (/enduro/.test(t)) out.push("enduro");
  if (/short track/.test(t)) out.push("xcc");
  if (/cross-country|cross country/.test(t)) out.push("xco");
  return out.length ? out : ["mtb"];
}

/**
 * UCI MTB World Series calendar (`ucimtbworldseries.com/calendar`).
 * SSR cards include `/events/{slug}-2026` plus `22-24 May 26` and a country label.
 */
export function parseUciMtbWorldSeries(url: string, html: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const hrefRe = /href="(\/events\/[a-z0-9-]+-20\d{2})"/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(html))) {
    const path = hm[1]!;
    const slug = path.split("/").pop()!;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const window = html.slice(Math.max(0, hm.index - 200), hm.index + 2800);
    const parsed = parseUciDate(window.replace(/<[^>]+>/g, " "));
    if (!parsed) continue;

    const decode = (s: string) =>
      s
        .replace(/&#x27;|&apos;/gi, "'")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const alt = decode(window.match(/alt="([^"]+)"/)?.[1] || "");
    const countries = [...window.matchAll(/uppercase">([^<]{3,40})<\/span>/g)].map((x) =>
      decode(x[1]!),
    );
    const countryName = countries.find((s) => COUNTRY[s.toLowerCase()]) || "";
    const place =
      alt ||
      countries.find((s) => !COUNTRY[s.toLowerCase()] && s.length > 2) ||
      slug.replace(/-20\d{2}$/, "").replace(/-/g, " ");
    const slugCountry = /korea|yongpyong/i.test(slug)
      ? "KR"
      : /whistler/i.test(slug)
        ? "CA"
        : /soldier-hollow|lake-placid/i.test(slug)
          ? "US"
          : undefined;

    let abs: string;
    try {
      abs = new URL(path, url).toString();
    } catch {
      continue;
    }

    events.push({
      externalId: `uciws-${slug}`,
      name: `UCI MTB World Series — ${place}`,
      startDate: parsed.start,
      endDate: parsed.end,
      placeText: place,
      countryHint: COUNTRY[countryName.toLowerCase()] || slugCountry,
      discipline: mapDisc(window),
      audience: "mixed",
      seriesName: "UCI MTB World Series",
      seriesSlug: "uci-mtb-world-series",
      seriesWebsite: "https://www.ucimtbworldseries.com/calendar",
      sourceUrl: url,
      websiteUrl: abs,
      confidence: 0.9,
    });
  }

  return events;
}
