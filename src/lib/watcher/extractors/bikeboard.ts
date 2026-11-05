import * as cheerio from "cheerio";
import type { Audience, Discipline, ParsedEvent } from "@/lib/domain";
import type { EventType } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";
import { mapPool } from "@/lib/watcher/pool";

const ORIGIN = "https://bikeboard.at";
const MAX_PAGES = 14;
/** Detail pages are one fetch each, so only upcoming races earn one. */
const MAX_DETAILS = 60;

const MONTHS: Record<string, number> = {
  jan: 1, jän: 1, feb: 2, mar: 3, mär: 3, apr: 4, mai: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
};

/**
 * Bikeboard tags every entry from a controlled vocabulary: the bike type says
 * which family a race belongs to, the event kind says which discipline.
 */
const KIND_DISCIPLINE: Record<string, Discipline> = {
  "cross country": "xco",
  "short-track": "xcc",
  eliminator: "xce",
  "downhill/freeride": "dh",
  enduro: "enduro",
  gravelrennen: "gravel",
  hillclimb: "hill_climb",
  straßenrennen: "road_race",
  strassenrennen: "road_race",
  etappenrennen: "road_race",
  zeitfahren: "tt",
  kriterium: "criterium",
  granfondo: "gran_fondo",
  querfeldein: "cx",
  pumptrack: "bmx",
  dirt: "bmx",
  trial: "other",
};

const TYPE_DISCIPLINE: Record<string, Discipline> = {
  mtb: "mtb",
  "e-mtb": "mtb",
  rennrad: "road",
  "e-rennrad": "road",
  gravelbike: "gravel",
  "e-gravelbike": "gravel",
};

/** Entries that are not a bike race at all. */
const NOT_A_RACE = new Set(["fahrtechnik", "training", "messe/flohmarkt", "triathlon"]);
const RIDE_KINDS = new Set(["tour", "unsupported bike adventure"]);
const YOUTH_KINDS = new Set(["nachwuchsbewerb"]);

export function isBikeboardHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("bikeboard.at");
}

/**
 * The calendar is server-rendered and paginated as `/termine/<year>/seite-N`.
 * Watch the bare `/termine` URL and let this walk the current and next year, so
 * the source does not need editing every January.
 */
export async function parseBikeboardCalendar(url: string, html: string): Promise<ParsedEvent[]> {
  // Since the 2026 redesign one page lists every upcoming race, and year URLs redirect to it.
  const listed = parseBikeboardListing(url, html);
  if (listed.length) return enrichFromDetailPages(listed);

  const years = /\/termine\/\d{4}/.test(url)
    ? [Number(url.match(/\/termine\/(\d{4})/)![1])]
    : [new Date().getUTCFullYear(), new Date().getUTCFullYear() + 1];

  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (const year of years) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const pageUrl =
        page === 1 ? `${ORIGIN}/termine/${year}` : `${ORIGIN}/termine/${year}/seite-${page}`;
      // The watcher already fetched the first page when it was the watched URL.
      const body =
        page === 1 && url.includes(`/termine/${year}`) ? html : await fetchPage(pageUrl);
      if (!body) break;

      const rows = parseBikeboardPage(pageUrl, body);
      if (!rows.length) break;

      let added = 0;
      for (const ev of rows) {
        if (seen.has(ev.externalId)) continue;
        seen.add(ev.externalId);
        events.push(ev);
        added += 1;
      }
      if (!added) break;
    }
  }

  return enrichFromDetailPages(events);
}

async function fetchPage(url: string): Promise<string | null> {
  const res = await fetchText(url, { timeoutMs: 20_000 });
  return res.ok && res.text ? res.text : null;
}

/** Status labels that share the chip markup but say nothing about the race. */
const NOT_A_KIND = /woche|heute|morgen|neu$/i;

/** The redesigned calendar: one link per race, with the year and exact point as attributes. */
export function parseBikeboardListing(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  $("a.ev").each((_, el) => {
    const $row = $(el);
    const href = $row.attr("href") ?? "";
    const id = href.match(/termin(\d+)\s*$/)?.[1];
    const day = Number($row.find(".ev-day").first().text().trim());
    const mon = MONTHS[$row.find(".ev-mon").first().text().trim().slice(0, 3).toLowerCase()];
    const year = Number($row.attr("data-jahr"));
    if (!id || !day || !mon || !year) return;

    const $title = $row.find(".ev-title").first().clone();
    $title.find(".chip").remove();
    const name = $title.text().replace(/\s+/g, " ").trim();
    if (name.length < 3) return;

    const chips = $row.find(".ev-chips .chip").map((_i, c) => $(c).text().trim().toLowerCase()).get().filter(chip => chip && !NOT_A_KIND.test(chip));
    const types = chips.filter(chip => chip in TYPE_DISCIPLINE);
    const kinds = chips.filter(chip => !(chip in TYPE_DISCIPLINE));
    const racing = kinds.filter(kind => !NOT_A_RACE.has(kind));
    if (kinds.length && !racing.length) return;
    const discipline = disciplinesFor(racing, types);
    const startDate = iso(year, mon, day);
    if (!discipline.length || !startDate) return;

    const lat = Number($row.attr("data-lat")), lng = Number($row.attr("data-lng"));
    const hasPoint = $row.attr("data-lat") && $row.attr("data-lng") && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    events.push({
      externalId: `bikeboard-${id}`,
      name: name.slice(0, 160),
      startDate,
      placeText: $row.find(".ev-place").first().text().replace(/\s+/g, " ").trim(),
      countryHint: countryFrom($row.find(".ev-place img").first().attr("src")),
      discipline,
      audience: audienceFor(racing),
      ...eventTypeFor(racing),
      ...(hasPoint ? { lat, lng } : {}),
      sourceUrl: href.startsWith("http") ? href : new URL(href, url).toString(),
      confidence: 0.85,
    });
  });
  return events;
}

export function parseBikeboardPage(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];

  $("tr").each((_, el) => {
    const $row = $(el);
    const $date = $row.find("td.termine-col-date").first();
    if (!$date.length) return;

    const day = Number($date.find(".tev-date__day").first().text().trim());
    const mon = MONTHS[$date.find(".tev-date__mon").first().text().trim().toLowerCase()];
    const year = Number($date.find(".tev-date__year").first().text().trim());
    if (!day || !mon || !year) return;

    const name = $row.find("td.termine-col-event a").first().text().replace(/\s+/g, " ").trim();
    const href = $row.find("td.termine-col-event a").first().attr("href") ?? "";
    const id = href.match(/termin(\d+)\s*$/)?.[1];
    if (!name || name.length < 3 || !id) return;

    const kinds = $row
      .find(".tev-chip--sub")
      .map((_i, c) => $(c).text().trim().toLowerCase())
      .get();
    const types = $row
      .find(".tev-chip--cat")
      .map((_i, c) => $(c).text().trim().toLowerCase())
      .get();

    const racing = kinds.filter((k) => !NOT_A_RACE.has(k));
    if (kinds.length && !racing.length) return;

    const discipline = disciplinesFor(racing, types);
    if (!discipline.length) return;

    const startDate = iso(year, mon, day);
    if (!startDate) return;

    events.push({
      externalId: `bikeboard-${id}`,
      name: name.slice(0, 160),
      startDate,
      endDate: endDateFrom($date.find(".tev-date__bis").first().text(), year, mon, day),
      placeText: $row.find("td.termine-col-location span").first().text().replace(/\s+/g, " ").trim(),
      countryHint: countryFrom($row.find("td.termine-col-location img").first().attr("src")),
      discipline,
      audience: audienceFor(racing),
      ...eventTypeFor(racing),
      sourceUrl: href.startsWith("http") ? href : new URL(href, url).toString(),
      confidence: 0.85,
    });
  });

  return events;
}

function disciplinesFor(kinds: string[], types: string[]): Discipline[] {
  const found = new Set<Discipline>();
  for (const k of kinds) {
    const mapped = KIND_DISCIPLINE[k];
    if (mapped) found.add(mapped);
    // "Marathon" reads as an MTB marathon or a road gran fondo depending on the bike.
    if (k === "marathon") {
      if (types.some((t) => t.includes("mtb"))) found.add("xcm");
      else if (types.some((t) => t.includes("rennrad"))) found.add("gran_fondo");
      else if (types.some((t) => t.includes("gravel"))) found.add("gravel");
      else found.add("xcm");
    }
  }
  if (found.size) return [...found];
  for (const t of types) {
    const mapped = TYPE_DISCIPLINE[t];
    if (mapped) found.add(mapped);
  }
  return [...found];
}

function audienceFor(kinds: string[]): Audience {
  return kinds.some((k) => YOUTH_KINDS.has(k)) ? "kids" : "mixed";
}

function eventTypeFor(kinds: string[]): { eventType?: EventType } {
  if (kinds.length && kinds.every((k) => RIDE_KINDS.has(k))) return { eventType: "ride" };
  return {};
}

/** The "bis" cell drops the year, so a range over New Year rolls it forward. */
function endDateFrom(raw: string, year: number, startMonth: number, startDay: number): string | undefined {
  const m = raw.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]{3,})/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const mon = MONTHS[m[2]!.slice(0, 3).toLowerCase()];
  if (!day || !mon) return undefined;
  const endYear = mon < startMonth ? year + 1 : year;
  const end = iso(endYear, mon, day);
  return end && end !== iso(year, startMonth, startDay) ? end : undefined;
}

function countryFrom(src: string | undefined): string | undefined {
  const code = src?.match(/flags\/4x3\/([a-z]{2})\.svg/i)?.[1];
  return code ? code.toUpperCase() : undefined;
}

function iso(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * The listing gives a town; the detail page gives the organiser's own site and
 * the postcode, which is what makes a pin land in the right village.
 */
async function enrichFromDetailPages(events: ParsedEvent[]): Promise<ParsedEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, MAX_DETAILS);
  if (!upcoming.length) return events;

  const extras = await mapPool(upcoming, 5, async (ev) => {
    try {
      const page = await fetchText(ev.sourceUrl, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return { id: ev.externalId };
      return { id: ev.externalId, ...detailFacts(page.text) };
    } catch {
      return { id: ev.externalId };
    }
  });

  const byId = new Map(extras.map((x) => [x.id, x]));
  return events.map((ev) => {
    const extra = byId.get(ev.externalId);
    if (!extra) return ev;
    return {
      ...ev,
      ...(extra.website ? { websiteUrl: extra.website } : {}),
      ...(extra.place ? { placeText: extra.place } : {}),
    };
  });
}

export function detailFacts(html: string): { website?: string; place?: string } {
  const $ = cheerio.load(html);
  const out: { website?: string; place?: string } = {};

  const homepage = $("a.tdv2-btn--primary[href^='http']").first().attr("href");
  if (homepage) {
    try {
      const u = new URL(homepage);
      u.searchParams.delete("utm_source");
      if (!isBikeboardHost(u.hostname)) out.website = u.toString().replace(/\?$/, "");
    } catch {
      /* keep the listing's link */
    }
  }

  // The redesigned page: plain label and value pairs in the sidebar.
  $(".side .fact").each((_, el) => {
    const label = $(el).find("span").first().text().trim();
    if (label === "Homepage" && !out.website) {
      const link = $(el).find("a[href^='http']").first().attr("href");
      try {
        if (link) {
          const u = new URL(link);
          u.searchParams.delete("utm_source");
          u.searchParams.delete("utm_medium");
          if (!isBikeboardHost(u.hostname)) out.website = u.toString().replace(/\?$/, "");
        }
      } catch { /* keep the listing's link */ }
    }
    if (label === "Ort") {
      // "4600 Wels<br>Oberösterreich": the town line, not the federal state.
      const town = ($(el).find("b").first().html() ?? "").split(/<br\s*\/?>/i)[0]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (town) out.place = cheerio.load(`<i>${town}</i>`).text();
    }
  });

  $(".tdv2-fact").each((_, el) => {
    if ($(el).find(".tdv2-fact-key").first().text().trim() !== "Ort") return;
    const place = $(el).find(".tdv2-fact-val").first().text().replace(/\s+/g, " ").trim();
    if (place) out.place = place;
  });

  return out;
}
