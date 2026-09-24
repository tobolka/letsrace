import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { isJunkListingName } from "@/lib/event-visibility";
import { fold } from "@/lib/text-match";

const MONTHS_CS: Record<string, string> = {
  ledna: "01",
  lednu: "01",
  "února": "02",
  "únoru": "02",
  "března": "03",
  "březnu": "03",
  dubna: "04",
  dubnu: "04",
  "května": "05",
  "květnu": "05",
  "června": "06",
  "červnu": "06",
  "července": "07",
  "červenci": "07",
  srpna: "08",
  srpnu: "08",
  "září": "09",
  "října": "10",
  "říjnu": "10",
  listopadu: "11",
  prosince: "12",
  prosinci: "12",
};

export function extractGeneric(url: string, html: string): ParsedEvent[] {
  // RoadCup's season index lists many races. Treating its heading as one race
  // invented a "RoadCup 2027" event on the first date found in the table.
  if (/roadcycling\.cz\/roadcup\/rocnik-20\d{2}(?:\/|$)/i.test(url)) return [];
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ");

  const validDay = (day: string): boolean => {
    const parsed = new Date(`${day}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  };
  const iso = [...text.matchAll(/20\d{2}-\d{2}-\d{2}/g)]
    .map((match) => match[0]).find(validDay);
  const cs = [...text.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/g)]
    .map((match) => `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`)
    .find(validDay);
  const csWord = [...text.matchAll(/(\d{1,2})\.\s*([A-Za-zÁ-ž]+)\s+(20\d{2})/g)]
    .map((match) => {
      const month = MONTHS_CS[match[2]!.toLowerCase()];
      return month ? `${match[3]}-${month}-${match[1]!.padStart(2, "0")}` : "";
    }).find(validDay);
  const startDate = iso || cs || csWord || "";

  const name = title.replace(/\s*[|\-–].*$/, "").trim().slice(0, 140);
  if (!startDate || !name) return [];
  if (isJunkListingName(name)) return [];
  if (isSiteIdentityName(name, url)) return [];
  if (isStaleDate(startDate)) return [];

  // Disciplines from the title only. Scanning the whole body made a club
  // homepage that lists its season inherit every discipline on the page —
  // one "Sportchallenge" row came out tagged road+xcm+xco+tt+enduro+track.
  const disciplines: ParsedEvent["discipline"] = [];
  if (/gravel/i.test(title)) disciplines?.push("gravel");
  if (/silnic|road|kritérium/i.test(title)) disciplines?.push("road");
  if (/\bxcm\b|maraton/i.test(title)) disciplines?.push("xcm");
  if (/\bxc\b|cross.?country|xco/i.test(title)) disciplines?.push("xco");
  if (/časovka|time.?trial|\btt\b/i.test(title)) disciplines?.push("tt");
  if (/enduro/i.test(title)) disciplines?.push("enduro");
  if (/dráha|track/i.test(title)) disciplines?.push("track");
  if (/\bbmx\b/i.test(title)) disciplines?.push("bmx");

  const audience = /junior|žák|deti|děti|kids|mládež|talent/i.test(title) ? "kids" : "mixed";

  return [
    {
      externalId: `generic-${normalizeName(title)}-${startDate}`,
      name,
      startDate,
      placeText: guessPlace(text) || "Unknown",
      countryHint: guessCountry(url, text),
      discipline: disciplines?.length ? disciplines : undefined,
      audience,
      sourceUrl: url,
      confidence: 0.35,
    },
  ];
}

/** Navigation labels and section headings — a page's chrome, not a race. */
const NAV_LABEL =
  /^(domu|home|homepage|novinky|news|aktuality|aktuell|uvod|start|startseite|kontakt|kontakty|contact|o nas|about|about us|onas|clanky|blog|galerie|gallery|fotogalerie|vysledky|results|kalendar|program|informace|info|menu|prihlaseni|registrace|obchod|shop|eshop|e shop|partneri|sponzori|dokumenty|ke stazeni|historie|clenove|vitejte|welcome|test)$/;

/** Legal-entity suffixes, stripped before comparing a title to its domain. */
const ORG_SUFFIX =
  /\b(s\s?r\s?o|spol|z\s?s|gmbh|mbh|ohg|kg|sp\s?z\s?o\s?o|srl|ltd|llc|inc|e\s?v|tj|tk|sk|sc|rsv|rc|kct)\b/g;

const squash = (s: string) => s.replace(/[^a-z0-9]/g, "");

/**
 * True when the title names the site itself rather than an event on it.
 *
 * The generic strategy is the last resort — it fires on pages no adapter
 * claimed, which in practice are club and single-race homepages, and it builds
 * an "event" from the `<title>` plus the first date anywhere in the body. That
 * produced rows called "Domů", "nizinacup" and "CYKLOŠVEC s.r.o.".
 *
 * The test is deliberately narrow: a navigation label, or a title that is just
 * the site's own domain. Broader rules (one-word titles, club suffixes) looked
 * tempting and were wrong — "Glocknerkönig", "Quebrantahuesos" and "Nieuwjaars-
 * cross" are one-word races, and "Kriterium des RSV Speiche e.V. Leipzig" is a
 * real criterium that a club happens to run. Rejecting a single-race homepage
 * costs little either way: a race with its own site is almost always already in
 * the catalog from a calendar that describes it properly.
 */
export function isSiteIdentityName(name: string, url?: string): boolean {
  const t = fold(name).replace(/[^a-z0-9]+/g, " ").trim();
  if (!t) return true;
  if (NAV_LABEL.test(t)) return true;
  if (!url) return false;

  let host = "";
  try {
    host = squash(fold(new URL(url).hostname).replace(/^www\./, ""));
  } catch {
    return false;
  }
  const bare = squash(t.replace(ORG_SUFFIX, ""));
  if (bare.length < 4) return true;
  return host.includes(bare);
}

/**
 * Generic date-grabbing picks the first date anywhere in the body, which on an
 * archive page is often years old. Anything already past is not a listing worth
 * creating from a guess.
 */
function isStaleDate(startDate: string, now = new Date()): boolean {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return startDate < cutoff;
}

function guessPlace(text: string): string | null {
  const m = text.match(
    /\b(Hradec Králové|Praha|Brno|Ostrava|Plzeň|Liberec|Olomouc|Pardubice|Klatovy|Sušice|Karlovy Vary|Bratislava|Wien|Dresden|Kraków)\b/,
  );
  return m?.[1] ?? null;
}

function guessCountry(url: string, text: string): string {
  const blob = url + text;
  if (/\.si\b|slovinsko|slovenia|slovenija/i.test(blob)) return "SI";
  if (/\.dk\b|dánsko|dansko|denmark|dänemark/i.test(blob)) return "DK";
  if (/\.nl\b|nizozemsko|netherlands|nederland|holland/i.test(blob)) return "NL";
  if (/\.be\b|belgie|belgicko|belgium|belgien|belgique/i.test(blob)) return "BE";
  if (/\.cz\b|Česk|Czech/i.test(blob)) return "CZ";
  if (/\.sk\b|Slovensk/i.test(blob)) return "SK";
  if (/\.de\b|Deutsch|Germany/i.test(blob)) return "DE";
  if (/\.at\b|Öster|Austria/i.test(blob)) return "AT";
  if (/\.pl\b|Polsk|Poland/i.test(blob)) return "PL";
  if (/\.it\b|Italia|Italy/i.test(blob)) return "IT";
  return "CZ";
}
