import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { inferRaceLevel } from "@/lib/race-level";

const WEEKDAYS = /^(pondělí|úterý|středa|čtvrtek|pátek|sobota|neděle)$/i;

const SKIP =
  /\b(běh|beh |půlmaraton|pulmaraton|marat[oó]n\b(?!.*mtb)|trail run|běžec|bezec|tempo makers|osvračín|osvracin|přeštice|prestice|kralovick)/i;

const BIKE_HINT =
  /\b(mtb|xco|xcc|xcm|xc\b|dh\b|enduro|gravel|silnice|cyklo|bike|kpž|kpz|čp|cp\b|uci|kolo|talent|bundesliga|pražský pohár|prazsky|cyclo|cx\b|biatlon|kolopro|manitou|galaxy|tour)\b/i;

/** Known Hynek `?serialosss=` codes → canonical series */
export const HYNEK_SERIES: Record<string, { name: string; slug: string; audience?: "kids" | "mixed" | "adults" }> =
  {
    tc: { name: "Talent Cup", slug: "talent-cup", audience: "kids" },
    kpz: { name: "Kolo pro život", slug: "kolo-pro-zivot", audience: "mixed" },
    ppkhk: { name: "Pohár Plzeňského kraje HK", slug: "pohar-plz-kraje-hk", audience: "kids" },
    pkkhk: { name: "Pohár KV kraje HK", slug: "pohar-kv-kraje-hk", audience: "kids" },
    mtbb: { name: "MTB Biatlon", slug: "mtb-biatlon", audience: "mixed" },
    forest: { name: "Forestovo závody", slug: "forestovo-zavody", audience: "mixed" },
    uci: { name: "UCI Championships", slug: "uci-championships", audience: "adults" },
    uciXC: { name: "UCI MTB World Cup", slug: "uci-mtb-world-cup", audience: "adults" },
    uciX: { name: "UCI Cyclocross World Cup", slug: "uci-cx-world-cup", audience: "adults" },
    "čp": { name: "Czech Cups & Championships", slug: "czech-cups-champs", audience: "mixed" },
    "čpXC": { name: "ČP MTB", slug: "cp-mtb", audience: "mixed" },
    "čpX": { name: "ČP Cyklokros", slug: "cp-cyclocross", audience: "mixed" },
    prima: { name: "Prima Cup & XCM Czech Cup", slug: "prima-cup-xcm", audience: "mixed" },
    mtbbl: { name: "MTB Bundesliga", slug: "mtb-bundesliga", audience: "adults" },
    pmtbp: { name: "Pražský pohár MTB", slug: "prazsky-pohar-mtb", audience: "mixed" },
    tbc: { name: "TBC série cyklokros", slug: "tbc-cyclocross", audience: "mixed" },
  };

function yearHint(html: string): number {
  const m = html.match(/Dnes je[^,]*,\s*\d{1,2}\.\d{1,2}\.(\d{4})/i);
  if (m) return Number(m[1]);
  return new Date().getFullYear();
}

function parseDayMonth(text: string, year: number): string | null {
  const m = text.replace(/\s+/g, "").match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (!m) return null;
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function mapSeriesDisc(series: string, name: string): Discipline[] | undefined {
  const t = `${series} ${name}`.toLowerCase();
  if (/xcm|maraton|kpž|kpz|kolopro|prima/.test(t)) return ["xcm"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/silnice|road/.test(t)) return ["road"];
  if (/cyclo|cx|cyklo.?kros/.test(t)) return ["cx"];
  if (/\bdh\b|enduro/.test(t)) return ["dh"];
  if (/biatlon/.test(t)) return ["biathlon"];
  if (/mtb|xco|xcc|xc\b|talent|čp mtb|cp mtb/.test(t)) return ["xc"];
  return undefined;
}

function slugifySeries(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "series";
}

/** "5. TalentCUP" / "Talent CUP" → { name, slug } */
export function canonicalizeSeries(raw: string): { name: string; slug: string } | null {
  const stripped = raw.replace(/^\d+\.\s*/, "").replace(/\|/g, "").trim();
  if (!stripped || stripped.length < 2) return null;

  const key = normalizeName(stripped);
  const aliases: Record<string, string> = {
    "talent cup": "Talent Cup",
    talentcup: "Talent Cup",
    "kolo pro zivot": "Kolo pro život",
    kpz: "Kolo pro život",
    "cp mtb": "ČP MTB",
    "c p mtb": "ČP MTB",
    "cesky pohar mtb": "ČP MTB",
    "uci mtb world cup": "UCI MTB World Cup",
    "uci c1": "UCI / C1",
    "prazsky pohar mtb": "Pražský pohár MTB",
    "mtb biatlon": "MTB Biatlon",
    "mtb bundesliga": "MTB Bundesliga",
    "prima cup xcm czech cup": "Prima Cup & XCM Czech Cup",
    primacup: "Prima Cup",
  };
  for (const [k, name] of Object.entries(aliases)) {
    if (key === k || key.includes(k)) {
      return { name, slug: slugifySeries(name) };
    }
  }
  // Reject discipline / stage labels that aren't real series
  if (
    /^(xcm|xc|xco|xcc|dh|edr|track|silnice|road|gravel|akce|event|4x|mtbo)(\/.*)?$/i.test(stripped) ||
    /^xco\/xcc/i.test(stripped)
  ) {
    return null;
  }
  // Generic cleanup
  const name = stripped
    .replace(/CUP/gi, "Cup")
    .replace(/TALENT/gi, "Talent")
    .replace(/\s+/g, " ")
    .trim();
  if (/^track$/i.test(name) || /^edr$/i.test(name)) return null;
  return { name, slug: slugifySeries(name) };
}

function seriesFromUrl(url: string): { name: string; slug: string; audience?: string } | null {
  try {
    const code = new URL(url).searchParams.get("serialosss");
    if (!code) return null;
    const known = HYNEK_SERIES[code] || HYNEK_SERIES[decodeURIComponent(code)];
    if (known) return known;
    return { name: code, slug: slugifySeries(code) };
  } catch {
    return null;
  }
}

/** Collect `?serialosss=` series pages to watch as child sources */
export function discoverHynekSeriesUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href*='serialosss=']").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const u = new URL(href, "https://hynekmusil.cz");
      const code = u.searchParams.get("serialosss");
      if (!code) return;
      // skip empty "back to full calendar"
      if (!code.trim()) return;
      urls.add(`https://hynekmusil.cz/?serialosss=${encodeURIComponent(code)}`);
    } catch {
      /* ignore */
    }
  });
  return [...urls];
}

export function parseHynekMusil(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const year = yearHint(html);
  const events: ParsedEvent[] = [];
  const pageSeries = seriesFromUrl(url);
  const seriesChildUrls = discoverHynekSeriesUrls(html);

  $("tr").each((_, el) => {
    const tds = $(el).children("td");
    if (tds.length < 4) return;

    let seriesRaw = "";
    let weekday = "";
    let dateRaw = "";
    let placeName = "";

    tds.each((i, td) => {
      const text = $(td).text().replace(/\s+/g, " ").trim();
      const htmlCell = $(td).html() || "";
      if (/<br\s*\/?>/i.test(htmlCell) && !placeName) {
        const parts = htmlCell
          .split(/<br\s*\/?>/i)
          .map((p) => cheerio.load(`<span>${p}</span>`)("span").text().replace(/\s+/g, " ").trim())
          .filter(Boolean);
        if (parts.length >= 2) {
          placeName = parts.join(" | ");
          return;
        }
      }
      if (WEEKDAYS.test(text)) weekday = text;
      else if (/^\d{1,2}\.\d{1,2}\.?$/.test(text.replace(/\s+/g, ""))) dateRaw = text;
      else if (!seriesRaw && text && !WEEKDAYS.test(text) && i > 0 && text.length < 40) seriesRaw = text;
      else if (!placeName && text.length > 3 && i >= 3) placeName = text;
    });

    if (!dateRaw || !placeName) return;
    const startDate = parseDayMonth(dateRaw, year);
    if (!startDate) return;

    const blob = `${seriesRaw} ${placeName} ${weekday}`;
    if (SKIP.test(blob) && !BIKE_HINT.test(blob)) return;
    if (!BIKE_HINT.test(blob) && !/čp|cp |kpž|kpz|talent|uci|mtb|xc/i.test(seriesRaw)) {
      if (!/čp|cp|pohár|pohar|cup|série|serie/i.test(seriesRaw) && !pageSeries) return;
    }

    let place = "Czechia";
    let name = placeName;
    if (placeName.includes("|")) {
      const [a, ...rest] = placeName.split("|").map((s) => s.trim());
      const b = rest.join(" ").trim();
      if (
        /uci|world cup|čp|cp\b|cup|kpž|kpz|pohár|pohar|maraton|tour|c1|c2|c3/i.test(a) &&
        (/,/.test(b) || /france|belgium|italy|germany|švýcar|slovakia|slovensko|ostrava|praha|brno/i.test(b))
      ) {
        name = a;
        place = b;
      } else if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9\s\-–]+$/.test(b) && b.length > 4) {
        place = a;
        name = b;
      } else {
        place = a || place;
        name = b || placeName;
      }
    } else if (/^(uci|čp|cp\b|mtb|xco)/i.test(placeName)) {
      name = placeName;
      const city = placeName.match(/\b(OSTRAVA|PRAHA|BRNO|PLZEŇ|PLZEN|VESEC|CHOMUTOV|JABLONEC)\b/i);
      if (city) place = city[1];
    } else {
      const m = placeName.match(
        /^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\wÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž.-]*(?:\s+(?:nad|u)\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][\wÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž.-]*)?)\s+(.+)$/,
      );
      if (m && m[2].length > 3) {
        place = m[1];
        name = m[2];
      }
    }

    const series =
      pageSeries ||
      canonicalizeSeries(seriesRaw) ||
      (seriesRaw ? { name: seriesRaw.replace(/^\d+\.\s*/, ""), slug: slugifySeries(seriesRaw) } : null);

    // Race name should be the event, not "5. TalentCUP: …"
    name = name.replace(/^\d+\.\s*Talent\s*Cup[:\s-]*/i, "").trim() || name;

    const level = inferRaceLevel(`${series?.name ?? ""} ${name}`);
    const disc = mapSeriesDisc(series?.name ?? seriesRaw, name);
    const audience: ParsedEvent["audience"] =
      pageSeries?.audience === "kids" ||
      /talent|junior|žák|ml\+ž|mladez/i.test(`${series?.name ?? ""} ${name}`)
        ? "kids"
        : "mixed";

    const seriesCode =
      Object.entries(HYNEK_SERIES).find(([, v]) => v.slug === series?.slug)?.[0] ??
      new URL(url, "https://hynekmusil.cz").searchParams.get("serialosss");
    // Provenance only — never use hynekmusil as the public race website
    const provenanceUrl = seriesCode
      ? `https://hynekmusil.cz/?serialosss=${encodeURIComponent(seriesCode)}`
      : url.split("#")[0];

    const externalId = `hynek-${normalizeName(`${series?.slug ?? "x"}-${name}`)}-${startDate}`;
    events.push({
      externalId,
      name: name.slice(0, 120),
      startDate,
      placeText: place.slice(0, 80),
      countryHint: /france|belgium|italy|germany|švýcar|switzerland|slovensko/i.test(placeName)
        ? undefined
        : "CZ",
      discipline: disc,
      audience,
      seriesName: series?.name,
      seriesSlug: series?.slug,
      // no seriesWebsite → avoid linking series to hynekmusil calendar
      sourceUrl: provenanceUrl,
      confidence: pageSeries ? 0.86 : 0.74,
    });
    if (level.level === "c1" || level.level === "uci") {
      events[events.length - 1].confidence = 0.82;
    }
  });

  const deduped = dedupe(events).slice(0, 250);
  // Stash series URLs on first event so adapter can collect childUrls
  if (seriesChildUrls.length && deduped[0]) {
    deduped[0].childUrls = [...new Set([...(deduped[0].childUrls ?? []), ...seriesChildUrls])];
  }
  return deduped;
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
