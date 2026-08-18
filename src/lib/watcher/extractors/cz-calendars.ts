import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";
import { mapPool } from "@/lib/watcher/pool";

const CZ_MONTHS: Record<string, string> = {
  leden: "01",
  ledna: "01",
  unor: "02",
  únor: "02",
  unora: "02",
  února: "02",
  brezen: "03",
  březen: "03",
  brezna: "03",
  března: "03",
  duben: "04",
  dubna: "04",
  kveten: "05",
  květen: "05",
  kvetna: "05",
  května: "05",
  cerven: "06",
  červen: "06",
  cervna: "06",
  června: "06",
  cervenec: "07",
  červenec: "07",
  cervence: "07",
  července: "07",
  srpen: "08",
  srpna: "08",
  zari: "09",
  září: "09",
  rijen: "10",
  říjen: "10",
  rijna: "10",
  října: "10",
  listopad: "11",
  listopadu: "11",
  prosinec: "12",
  prosince: "12",
};

function foldMonth(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseCzIso(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const range = t.match(
    /(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (range) {
    const y = range[4]!;
    const mo = range[3]!.padStart(2, "0");
    return {
      start: `${y}-${mo}-${range[1]!.padStart(2, "0")}`,
      end: `${y}-${mo}-${range[2]!.padStart(2, "0")}`,
    };
  }
  const rangeCross = t.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (rangeCross) {
    const y = rangeCross[5]!;
    return {
      start: `${y}-${rangeCross[2]!.padStart(2, "0")}-${rangeCross[1]!.padStart(2, "0")}`,
      end: `${y}-${rangeCross[4]!.padStart(2, "0")}-${rangeCross[3]!.padStart(2, "0")}`,
    };
  }
  const one = t.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!one) return null;
  return {
    start: `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}`,
  };
}

function parseCzNamed(raw: string): string | null {
  const m = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})\.\s*([A-Za-záčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+)\s*(20\d{2})/);
  if (!m) return null;
  const mo = CZ_MONTHS[m[2]!] || CZ_MONTHS[foldMonth(m[2]!)];
  if (!mo) return null;
  return `${m[3]}-${mo}-${m[1]!.padStart(2, "0")}`;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function absHref(href: string | undefined, base: string): string | undefined {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("javascript:") || raw === "#") return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

function pathOnly(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function isPdfHref(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

function isSameListing(url: string, listingUrl: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(listingUrl);
    if (a.hostname.replace(/^www\./i, "") !== b.hostname.replace(/^www\./i, "")) {
      return false;
    }
    return pathOnly(a.toString()) === pathOnly(b.toString());
  } catch {
    return false;
  }
}

/** Prima Cup listing (`/zavody-2026/`) — dates live on each race page. */
export async function parsePrimaCup(url: string, html: string): Promise<ParsedEvent[]> {
  const $ = cheerio.load(html);
  const cards: { href: string; name: string }[] = [];
  const seen = new Set<string>();

  $('a.vc_gitem-link[href], a[href][title]').each((_, a) => {
    const href = $(a).attr("href") || "";
    const name = ($(a).attr("title") || $(a).text()).replace(/\s+/g, " ").trim();
    if (!/^https?:\/\/(www\.)?iprimacup\.cz\//i.test(href)) return;
    if (/\/zavody-?\d*|wp-login|wp-json|wp-content/i.test(href)) return;
    if (!/\/(26-[a-z]+|pm-20\d{2})\//i.test(href) && !/\/20\d{2}-/i.test(href)) {
      if (!/\/[a-z0-9-]+\/?$/i.test(new URL(href).pathname)) return;
      if ((new URL(href).pathname.replace(/\/$/, "").split("/").length) < 2) return;
    }
    if (!name || name.length < 4) return;
    if (seen.has(href)) return;
    seen.add(href);
    cards.push({ href, name });
  });

  const unique = cards.filter((c) => /\/(26-[a-z0-9]+|pm-20\d{2})\/?$/i.test(c.href));
  const pages = unique.slice(0, 16);

  const parsed = await mapPool(pages, 3, async (card): Promise<ParsedEvent | null> => {
    try {
      const page = await fetchText(card.href, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return null;
      const $$ = cheerio.load(page.text);
      const body = $$("article, .post_content, .entry-content, main").text() || $$.text();
      const yearHint = page.text.match(/20(2[6-9]|3\d)/)?.[0] ?? "2026";
      const weekendNamed = body.match(
        /(?:sobota|neděle|nedele)[,\s]+(\d{1,2})\.\s*([A-Za-záčďéěíňóřšťúůýž]+)(?:\s*(20\d{2}))?/i,
      );
      const weekendNumeric = body.match(
        /sobota[^\d]{0,40}(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/i,
      );
      const headingNamed = body.match(
        /harmonogram[^.]{0,80}?(\d{1,2})\.\s*([A-Za-záčďéěíňóřšťúůýž]+)/i,
      );
      const startDate =
        (weekendNamed
          ? parseCzNamed(
              `${weekendNamed[1]}. ${weekendNamed[2]} ${weekendNamed[3] || yearHint}`,
            )
          : null) ||
        (weekendNumeric
          ? parseCzIso(
              `${weekendNumeric[1]}.${weekendNumeric[2]}.${weekendNumeric[3]}`,
            )?.start
          : null) ||
        (headingNamed
          ? parseCzNamed(`${headingNamed[1]}. ${headingNamed[2]} ${yearHint}`)
          : null);
      if (!startDate) return null;

      const place =
        card.name
          .replace(/\s*20\d{2}\s*$/, "")
          .replace(
            /^(BEST|Silesia|BAIC|TCHIBO|KupKolo\.cz|FILIPA|LEADER FOX|YATE|Českopetrovická)\s+/i,
            "",
          )
          .trim() || card.name;

      let registrationUrl: string | undefined;
      let regulationsUrl: string | undefined;
      $$("a[href]").each((_, a) => {
        const href = absHref($$(a).attr("href"), card.href);
        if (!href) return;
        if (/\/prihlaseni\/?$/i.test(href) || /\/zavody-20\d{2}\/?$/i.test(href)) return;
        const text = $$(a).text().replace(/\s+/g, " ").trim();
        const blob = `${href} ${text}`;
        if (!registrationUrl && /prihlá|prihlas|registrac|sportsoft|raceresult|entrywall/i.test(blob)) {
          registrationUrl = href;
        }
        if (
          !regulationsUrl &&
          (isPdfHref(href) || /propozic|pravidla|rozpis/i.test(blob)) &&
          !/vysledk|výsled|fotogal/i.test(blob)
        ) {
          regulationsUrl = href;
        }
      });

      return {
        externalId: `prima-${normalizeName(card.name)}-${startDate}`,
        name: card.name.replace(/\s*20\d{2}\s*$/, "").trim() || card.name,
        startDate,
        placeText: place.slice(0, 80),
        countryHint: "CZ",
        discipline: ["xcm"],
        audience: "mixed",
        seriesName: "Prima Cup",
        seriesSlug: "primacup",
        seriesWebsite: "https://www.iprimacup.cz/",
        sourceUrl: card.href,
        websiteUrl: card.href,
        registrationUrl,
        regulationsUrl,
        confidence: 0.88,
      };
    } catch {
      return null;
    }
  });

  return parsed.filter((e) => e !== null);
}

const MARATON_SPORT: Record<string, Discipline> = {
  "c-cx": "cx",
  cx: "cx",
  "c-tt": "tt",
  tt: "tt",
  "c-road": "road_race",
  road: "road_race",
  "mtb-m": "xcm",
  "mtb-xcm": "xcm",
  mtb: "xco",
  "mtb-xco": "xco",
  gravel: "gravel",
  "c-crit": "criterium",
  crit: "criterium",
};

/** maraton.cz termínovka — bike rows only (skip RUN / TRI). */
export function parseMaratonTerminovka(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 4) return;
    const sport = (cells[1] ?? "").toUpperCase();
    if (/^(RUN|TRI|SWIM|SKI|OCR)/.test(sport)) return;
    const disc = MARATON_SPORT[sport.toLowerCase()];
    if (!disc && !/^(C-|MTB|ROAD|GRAVEL|CX)/.test(sport)) return;

    const dates = parseCzIso(cells[0] ?? "");
    if (!dates) return;
    const place = cells[2] || "Jižní Čechy";
    const name = (cells[3] || place)
      .replace(/\s*[-–]\s*přihláška.*$/i, "")
      .replace(/\s*\(TBC série\)\s*/i, "")
      .trim();
    if (!name || name.length < 3) return;

    const webHref = $tr.find("td").last().find("a[href]").attr("href");
    let websiteUrl: string | undefined;
    if (webHref && !/maraton\.cz/i.test(webHref)) {
      try {
        const u = new URL(webHref);
        if (u.protocol === "http:") u.protocol = "https:";
        websiteUrl = u.toString();
      } catch {
        /* keep */
      }
    }

    const externalId = `maraton-${dates.start}-${normalizeName(place)}-${normalizeName(name)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place,
      countryHint: "CZ",
      discipline: [disc ?? "other"],
      audience: "mixed",
      sourceUrl: url,
      websiteUrl,
      confidence: 0.8,
    });
  });

  return events;
}

/** Český pohár MTB XCO — `poharmtb.cz/cross-country` table. */
export function parsePoharMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table.race-table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const dates = parseCzIso($tr.find("td.date").text());
    if (!dates) return;
    const place = $tr.find("td.race strong").text().replace(/\s+/g, " ").trim();
    const venue = $tr.find("td.race span").text().replace(/\s+/g, " ").trim();
    if (!place) return;
    const tag = $tr.find(".tag").text().replace(/\s+/g, " ").trim();
    const name = venue ? `${place} — ${venue}` : place;
    const disc: Discipline[] = /xcc/i.test(tag) ? ["xcc"] : ["xco"];

    const externalId = `poharmtb-${dates.start}-${normalizeName(place)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const listing = "https://www.poharmtb.cz/cross-country";
    let regulationsUrl: string | undefined;
    let websiteUrl: string | undefined;
    $tr.find("td.links a[href]").each((_, a) => {
      const href = absHref($(a).attr("href"), url);
      if (!href) return;
      const text = $(a).text().replace(/\s+/g, " ").trim();
      if (/propozic/i.test(`${href} ${text}`)) {
        regulationsUrl = regulationsUrl || href;
        return;
      }
      if (isPdfHref(href)) {
        if (/technical|časov|casov|program/i.test(`${href} ${text}`)) return;
        regulationsUrl = regulationsUrl || href;
        return;
      }
      if (isSameListing(href, listing) || pathOnly(href) === "/") return;
      websiteUrl = websiteUrl || href;
    });
    const sourceUrl = websiteUrl || regulationsUrl || url;

    events.push({
      externalId,
      name: /mčr|mcr/i.test(tag) ? `MČR — ${name}` : `ČP MTB — ${name}`,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place,
      countryHint: "CZ",
      discipline: disc,
      audience: "mixed",
      seriesName: /mčr|mcr/i.test(tag) ? "MČR MTB" : "Český pohár MTB",
      seriesSlug: /mčr|mcr/i.test(tag) ? "mcr-mtb" : "cesky-pohar-mtb",
      seriesWebsite: "https://www.poharmtb.cz/",
      sourceUrl,
      websiteUrl: websiteUrl || listing,
      regulationsUrl,
      confidence: 0.9,
    });
  });

  return events;
}

/** ZAL season calendar (`/kalendare/zal-20XX`). */
export function parseZal(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("div.polozka").each((_, el) => {
    const $el = $(el);
    const dates = parseCzIso($el.find(".datum").text());
    if (!dates) return;
    const name = $el.find(".nadpis").text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;
    if (/vyhlášení|slavnost/i.test(name)) return;

    const href = absHref($el.find(".nadpis a").attr("href"), url);
    const origin = originOf(url);
    const year = dates.start.slice(0, 4);
    const websiteUrl = href || `${origin}/`;
    const regulationsUrl = href && /\/propozice\//i.test(href) ? href : undefined;
    const registrationUrl = `${origin}/prihlasky/zal-${year}`;

    const externalId = `zal-${dates.start}-${normalizeName(name)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name,
      startDate: dates.start,
      placeText: name.split("/")[0]!.trim().slice(0, 80),
      countryHint: "CZ",
      discipline: /časovka|casovka/i.test(name)
        ? ["tt"]
        : /kritérium|kriterium/i.test(name)
          ? ["criterium"]
          : ["road_race"],
      audience: "adults",
      seriesName: "Západočeská amatérská liga",
      seriesSlug: "zal",
      seriesWebsite: `${origin}/`,
      sourceUrl: href || url,
      websiteUrl,
      registrationUrl,
      regulationsUrl,
      confidence: 0.86,
    });
  });

  return events;
}

const PRAHA_KOLO_RE =
  /(\d+)\.\s*kolo\s*[–-]\s*(\d{1,2})\.\s*([A-Za-záčďéěíňóřšťúůýž]+)\s*(20\d{2})\s*,\s*([A-Za-záčďéěíňóřšťúůýž0-9 ]{2,40})/i;

function prahaPlaceLabel(place: string): string {
  return /motol|kbely|letňany|letnany|zličín|zlicin|libuš|libus|beckov/i.test(place)
    ? `Praha — ${place}`
    : place;
}

function prahaBlockLinks(
  html: string,
  pageUrl: string,
): { regulationsUrl?: string; registrationUrl?: string } {
  const $ = cheerio.load(`<div>${html}</div>`);
  let regulationsUrl: string | undefined;
  let registrationUrl: string | undefined;
  $("a[href]").each((_, a) => {
    const href = absHref($(a).attr("href"), pageUrl);
    if (!href) return;
    const text = $(a).text().replace(/\s+/g, " ").trim();
    const blob = `${href} ${text}`;
    if (
      !registrationUrl &&
      /sportt\.cz\/register|nazavody|prihlá|prihlas|registrac/i.test(blob)
    ) {
      registrationUrl = href;
    }
    if (
      !regulationsUrl &&
      /propozic/i.test(blob) &&
      !/vysledk|výsled|startovn/i.test(blob)
    ) {
      regulationsUrl = href;
    }
  });
  return { regulationsUrl, registrationUrl };
}

/** Pražský MTB pohár — propozice headings `N.kolo – DD. month YYYY, Place`. */
export function parsePrahaMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const root = $("article, .entry-content, main, body").first();
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const blocks: { heading: string; html: string }[] = [];
  let current: { heading: string; html: string } | null = null;

  root.find("p, h2, h3, h4").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const hm = text.match(PRAHA_KOLO_RE);
    if (hm && Number(hm[4]) >= 2026) {
      current = { heading: text, html: $.html(el) };
      blocks.push(current);
      return;
    }
    if (current) current.html += $.html(el);
  });

  for (const block of blocks) {
    const m = block.heading.match(PRAHA_KOLO_RE);
    if (!m) continue;
    const startDate = parseCzNamed(`${m[2]}. ${m[3]} ${m[4]}`);
    if (!startDate) continue;
    const round = m[1]!;
    const place = m[5]!.replace(/\s+/g, " ").trim();
    const externalId = `prahamtb-${startDate}-${normalizeName(place)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const links = prahaBlockLinks(block.html, url);
    const sourceUrl = links.regulationsUrl || url;
    events.push({
      externalId,
      name: `Pražský MTB pohár — ${round}. kolo ${place}`,
      startDate,
      placeText: prahaPlaceLabel(place),
      countryHint: "CZ",
      discipline: /xcc/i.test(place) ? ["xcc"] : ["xco"],
      audience: "mixed",
      seriesName: "Pražský MTB pohár",
      seriesSlug: "prazsky-mtb-pohar",
      seriesWebsite: "https://prahamtb.cz/",
      sourceUrl,
      websiteUrl: url,
      registrationUrl: links.registrationUrl,
      regulationsUrl: links.regulationsUrl,
      confidence: 0.86,
    });
  }

  if (events.length) return events;

  const text = $("article, .entry-content, main, body").text();
  const re = new RegExp(PRAHA_KOLO_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const year = Number(m[4]);
    if (year < 2026) continue;
    const startDate = parseCzNamed(`${m[2]}. ${m[3]} ${m[4]}`);
    if (!startDate) continue;
    const round = m[1];
    const place = m[5]!.replace(/\s+/g, " ").trim();
    const externalId = `prahamtb-${startDate}-${normalizeName(place)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    events.push({
      externalId,
      name: `Pražský MTB pohár — ${round}. kolo ${place}`,
      startDate,
      placeText: prahaPlaceLabel(place),
      countryHint: "CZ",
      discipline: /xcc/i.test(place) ? ["xcc"] : ["xco"],
      audience: "mixed",
      seriesName: "Pražský MTB pohár",
      seriesSlug: "prazsky-mtb-pohar",
      seriesWebsite: "https://prahamtb.cz/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.84,
    });
  }
  return events;
}

function enduroSeasonYear(html: string): number {
  const y = new Date().getFullYear();
  const years = [...html.matchAll(/20(?:2[5-9]|3\d)/g)]
    .map((m) => Number(m[0]))
    .filter((n) => n >= 2025 && n <= y + 1);
  return years.length ? Math.max(...years) : y;
}

/** Czech Enduro Series — official `/zavody/` listing. */
export function parseEnduroSerie(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const year = enduroSeasonYear(html);

  $('a[href*="/zavody/"]').each((_, a) => {
    const href = absHref($(a).attr("href"), url);
    const label = $(a).text().replace(/\s+/g, " ").trim();
    if (!href || !label) return;
    if (/\/zavody\/?$/i.test(href) || /tba/i.test(href)) return;
    const dates = parseCzIso(label) || parseCzNamed(label);
    const start = typeof dates === "string" ? dates : dates?.start;
    const dm = label.match(/(\d{1,2})\.\s*(\d{1,2})\.?/);
    const startDate =
      start ||
      (dm ? `${year}-${dm[2]!.padStart(2, "0")}-${dm[1]!.padStart(2, "0")}` : null);
    if (!startDate) return;

    const slug = href.replace(/\/$/, "").split("/").pop() || normalizeName(label);
    const externalId = `enduroserie-${slug}-${startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const name = label
      .replace(/^(proběhl|probiha|probíhá)\s+/i, "")
      .replace(/\s+\d{1,2}\.\s*\d{1,2}\.?\s*$/, "")
      .trim();
    events.push({
      externalId,
      name,
      startDate,
      placeText: name.replace(/^Enduro (Race|Challenge)\s+/i, "").replace(/\s+MČR$/i, "").trim() || name,
      countryHint: /czarna|gora/i.test(name) ? "PL" : "CZ",
      discipline: ["enduro"],
      audience: "mixed",
      seriesName: "Czech Enduro Series",
      seriesSlug: "czech-enduro-series",
      seriesWebsite: "https://www.enduroserie.cz/",
      sourceUrl: href,
      websiteUrl: href,
      confidence: 0.9,
    });
  });

  return events;
}

function enduroPageEntryLinks(pageUrl: string, html: string): {
  registrationUrl?: string;
  regulationsUrl?: string;
} {
  const $ = cheerio.load(html);
  let registrationUrl: string | undefined;
  let regulationsUrl: string | undefined;
  $("a[href]").each((_, a) => {
    const href = absHref($(a).attr("href"), pageUrl);
    if (!href) return;
    const text = $(a).text().replace(/\s+/g, " ").trim();
    const blob = `${href} ${text}`;
    if (
      !registrationUrl &&
      /njuko|sportsoft|raceresult|entrywall|prihlá|prihlas|registruj/i.test(blob)
    ) {
      if (!/\/registrace\/?$/i.test(href) || /njuko|sportsoft|raceresult/i.test(href)) {
        registrationUrl = href;
      }
    }
    if (!regulationsUrl && /propozic|technical|rozpis/i.test(blob) && !/registrac/i.test(blob)) {
      regulationsUrl = href;
    }
  });
  return { registrationUrl, regulationsUrl };
}

/** Attach Njuko / Sportsoft entry links from each Enduro race page. */
export async function enrichEnduroSerie(events: ParsedEvent[]): Promise<ParsedEvent[]> {
  const pages = events.filter((e) => e.websiteUrl && !isSameListing(e.websiteUrl, "https://www.enduroserie.cz/zavody/"));
  if (!pages.length) return events;
  const extras = await mapPool(pages.slice(0, 12), 3, async (ev) => {
    try {
      const page = await fetchText(ev.websiteUrl!, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return { id: ev.externalId };
      return { id: ev.externalId, ...enduroPageEntryLinks(ev.websiteUrl!, page.text) };
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
      registrationUrl: extra.registrationUrl || ev.registrationUrl,
      regulationsUrl: extra.regulationsUrl || ev.regulationsUrl,
    };
  });
}

/** SportSoft results calendar (`enduro.sportsoft.cz/2026/races.aspx`). */
export function parseEnduroSportsoft(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const blob = $("#ctl00_PObsah, .obsah, body").html() || html;
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{1,2}\.\d{1,2}\.20\d{2})(?:\s*[-–]\s*(\d{1,2}\.\d{1,2}\.20\d{2}))?\s*<br\s*\/?>\s*([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob))) {
    const start = parseCzIso(m[1]!)?.start;
    if (!start) continue;
    const end = m[2] ? parseCzIso(m[2])?.start : undefined;
    const name = m[3]!.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const externalId = `enduro-ss-${start}-${normalizeName(name)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    events.push({
      externalId,
      name,
      startDate: start,
      endDate: end && end !== start ? end : undefined,
      placeText: name.replace(/^Enduro (Race|CHALLENGE)\s+/i, "").trim() || name,
      countryHint: "CZ",
      discipline: ["enduro"],
      audience: "mixed",
      seriesName: "Czech Enduro Series",
      seriesSlug: "czech-enduro-series",
      seriesWebsite: "https://www.enduroserie.cz/",
      sourceUrl: url,
      websiteUrl: "https://www.enduroserie.cz/zavody/",
      confidence: 0.82,
    });
  }
  return events;
}

/** JANEV Cup + MČR cards on `/janev-cup-2026`; fallback for `/kalendar`. */
export function parseCyklokros(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const origin = originOf(url);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const seriesRegs = absCyklokrosHref(
    $('a[href*="rozpis-janev"], a[href*="janev-cup-2026-cyklokros"]').first().attr("href"),
    origin,
  );

  $(".box-container").each((_, box) => {
    const $box = $(box);
    const place = $box.find("h2").first().text().replace(/\s+/g, " ").trim();
    if (!place || /janev\s*cup/i.test(place)) return;
    const blob = $box.find("p").text().replace(/\s+/g, " ").trim();
    const dates = parseCzIso(blob);
    if (!dates) return;
    const href = absCyklokrosHref($box.find("a.btn[href], a[href*='/janev-'], a[href*='/mcr-']").first().attr("href"), origin);
    const media =
      $box.find("img").attr("data-srcset") ||
      $box.find("img").attr("src") ||
      $box.find(".container-background").attr("style") ||
      "";
    const uci = /c1-box/i.test(media) ? "C1" : /c2-box/i.test(media) ? "C2" : null;
    const isMcr = /mčr|mistrovství/i.test(blob) || /trikolora/i.test(media);
    const youth = /mládež/i.test(blob);
    const name = isMcr
      ? `MČR cyklokros${youth ? " mládež" : ""} — ${place}`
      : uci
        ? `JANEV Cup ${uci} — ${place}`
        : `JANEV Cup — ${place}`;
    const externalId = `${isMcr ? "mcr-cx" : "janev"}-${dates.start}-${normalizeName(place)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);
    events.push({
      externalId,
      name,
      startDate: dates.start,
      placeText: place,
      countryHint: "CZ",
      discipline: ["cx"],
      audience: youth ? "youth" : "mixed",
      seriesName: isMcr ? "Mistrovství ČR cyklokros" : "JANEV Cup",
      seriesSlug: isMcr ? "mcr-cyclocross" : "janev-cup",
      seriesWebsite: "https://www.cyklokros.cz/janev-cup-2026",
      sourceUrl: href || url.split("?")[0]!,
      websiteUrl: href || url.split("?")[0]!,
      regulationsUrl: seriesRegs,
      confidence: 0.92,
    });
  });
  if (events.length) return events;

  $("article, .sp-content, main")
    .find("h2, h3, li")
    .each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      const dates = parseCzIso(t) || parseCzNamed(t);
      const start = typeof dates === "string" ? dates : dates?.start;
      if (!start) return;
      if (/bude upřesněno|upresneno/i.test(t)) return;
      const name = t.replace(/\d{1,2}\.\s*\d{1,2}\.\s*20\d{2}/, "").trim();
      if (!name || name.length < 4) return;
      if (/^(pondělí|úterý|středa|čtvrtek|pátek|sobota|neděle)$/i.test(name)) return;
      const externalId = `cyklokros-${start}-${normalizeName(name)}`;
      if (seen.has(externalId)) return;
      seen.add(externalId);
      events.push({
        externalId,
        name,
        startDate: start,
        placeText: name,
        countryHint: "CZ",
        discipline: ["cx"],
        audience: "mixed",
        seriesName: "JANEV Cup",
        seriesSlug: "janev-cup",
        seriesWebsite: "https://www.cyklokros.cz/janev-cup-2026",
        sourceUrl: url,
        websiteUrl: url,
        confidence: 0.7,
      });
    });

  return events;
}

function absCyklokrosHref(href: string | undefined, origin: string): string | undefined {
  const raw = (href || "").trim();
  if (!raw) return undefined;
  try {
    return new URL(raw, origin).toString();
  } catch {
    return undefined;
  }
}

/**
 * Dětský MTB Cup Libereckého kraje — homepage `#zavody` product cards
 * (`.ProductView` + `.created` date + place heading).
 */
export function parseDetskyMtbCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $(".ProductView").each((_, el) => {
    const $el = $(el);
    const dates = parseCzIso($el.find(".created").first().text());
    if (!dates) return;
    const name = $el.find("h2").first().text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 2) return;
    if (/vyhlášení|vyhlaseni|slavnost/i.test(name)) return;

    const href = $el.find("h2 a").attr("href") || $el.find("a[href]").attr("href");
    let websiteUrl = "https://www.detskymtbcup.cz/";
    if (href) {
      websiteUrl = absHref(href, url) || websiteUrl;
    }
    let registrationUrl: string | undefined;
    let regulationsUrl: string | undefined;
    $el.find("a[href]").each((_, a) => {
      const link = absHref($(a).attr("href"), url);
      if (!link) return;
      const text = $(a).text().replace(/\s+/g, " ").trim();
      const blob = `${link} ${text}`;
      if (!registrationUrl && /nazavody|prihlá|prihlas|registrac/i.test(blob)) {
        registrationUrl = link;
      }
      if (
        !regulationsUrl &&
        /pravidla|propozic/i.test(blob) &&
        !/vysledk|výsled/i.test(blob)
      ) {
        regulationsUrl = link;
      }
    });

    const externalId = `detsky-mtb-${dates.start}-${normalizeName(name)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name: `Dětský MTB Cup — ${name}`,
      startDate: dates.start,
      placeText: name,
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Dětský MTB Cup",
      seriesSlug: "detsky-mtb-cup",
      seriesWebsite: "https://www.detskymtbcup.cz/",
      sourceUrl: websiteUrl,
      websiteUrl,
      registrationUrl,
      regulationsUrl,
      confidence: 0.9,
    });
  });

  return events;
}

function detskyPageLinks(pageUrl: string, html: string): {
  registrationUrl?: string;
  regulationsUrl?: string;
} {
  const $ = cheerio.load(html);
  let registrationUrl: string | undefined;
  let regulationsUrl: string | undefined;
  $("a[href]").each((_, a) => {
    const href = absHref($(a).attr("href"), pageUrl);
    if (!href) return;
    const text = $(a).text().replace(/\s+/g, " ").trim();
    const blob = `${href} ${text}`;
    if (!registrationUrl && /nazavody|prihlá|prihlas|registrac/i.test(blob)) {
      if (!/\/registrace\/nova-registrace/i.test(href)) registrationUrl = href;
    }
    if (
      !regulationsUrl &&
      /pravidla|propozic/i.test(blob) &&
      !/vysledk|výsled/i.test(blob)
    ) {
      regulationsUrl = href;
    }
  });
  return { registrationUrl, regulationsUrl };
}

/** Attach NaZavody entry + pravidla PDF from each Dětský MTB product page. */
export async function enrichDetskyMtbCup(events: ParsedEvent[]): Promise<ParsedEvent[]> {
  const pages = events.filter(
    (e) => e.websiteUrl && !isSameListing(e.websiteUrl, "https://www.detskymtbcup.cz/"),
  );
  if (!pages.length) return events;
  const extras = await mapPool(pages.slice(0, 12), 3, async (ev) => {
    try {
      const page = await fetchText(ev.websiteUrl!, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return { id: ev.externalId };
      return { id: ev.externalId, ...detskyPageLinks(ev.websiteUrl!, page.text) };
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
      registrationUrl: extra.registrationUrl || ev.registrationUrl,
      regulationsUrl: extra.regulationsUrl || ev.regulationsUrl,
    };
  });
}

function ustiPlace(name: string): string {
  const t = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/varvazov/.test(t)) return "Varvažov";
  if (/adolfov/.test(t)) return "Adolfov";
  if (/milada/.test(t)) return "Jezero Milada, Ústí nad Labem";
  if (/sektor/.test(t)) return "Ústí nad Labem";
  if (/letn[ia]k|letni kino/.test(t)) return "Ústí nad Labem";
  return "Ústí nad Labem — Střížák";
}

function ustiDiscipline(name: string): Discipline[] {
  const t = name.toLowerCase();
  if (/short\s*track|\bxcc\b/.test(t)) return ["xcc"];
  if (/eliminator|\bxce\b/.test(t)) return ["xce"];
  if (/marat/.test(t)) return ["xcm"];
  return ["xco"];
}

/** Elimon Ústí MTB Cup — homepage `table.basic_table` (current year first). */
export function parseUstiMtbCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table.basic_table tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length < 2) return;
    const dateRaw = $tds.eq(0).text().replace(/\s+/g, " ").trim();
    const name = $tds.eq(1).text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;
    if (
      /vyhlášení|vyhlaseni|slavnost|selfreport|dorovnání|dorovnani|zrušen|zrusen|nezapočítává|nezapocitava/i.test(
        name,
      )
    ) {
      return;
    }
    const dates = parseCzIso(dateRaw);
    if (!dates) return;

    const regHref = $tds.find("a[href*='prihlaska.php']").attr("href") || "";
    let registrationUrl: string | undefined;
    try {
      if (regHref) registrationUrl = new URL(regHref, url).toString();
    } catch {
      /* ignore */
    }

    const externalId = `usti-mtb-${dates.start}-${normalizeName(name)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name,
      startDate: dates.start,
      placeText: ustiPlace(name),
      countryHint: "CZ",
      discipline: ustiDiscipline(name),
      audience: "mixed",
      seriesName: "Ústí MTB Cup",
      seriesSlug: "usti-mtb-cup",
      seriesWebsite: "https://www.ustimtbcup.cz/",
      sourceUrl: registrationUrl || url.split("?")[0]!,
      websiteUrl: "https://www.ustimtbcup.cz/",
      registrationUrl,
      confidence: 0.9,
    });
  });

  return events;
}

const CZ_MONTH_NAME_RE =
  "ledna|února|unora|března|brezna|dubna|května|kvetna|června|cervna|července|cervence|srpna|září|zari|října|rijna|listopadu|prosince";

function seasonYearFromHtml(html: string): number {
  const y = new Date().getFullYear();
  const years = [...html.matchAll(/20(?:2[5-9]|3\d)/g)]
    .map((m) => Number(m[0]))
    .filter((n) => n >= 2025 && n <= y + 1);
  return years.length ? Math.max(...years) : y;
}

function namedDayToIso(day: string, monthRaw: string, year: number): string | null {
  const mo = CZ_MONTHS[monthRaw.toLowerCase()] || CZ_MONTHS[foldMonth(monthRaw)];
  if (!mo) return null;
  return `${year}-${mo}-${day.padStart(2, "0")}`;
}

/**
 * SK Velo Praha — O Pohár MČ Praha 4 at Traily Velký Háj.
 * Stable club page; dates for next year replace the “Termíny závodů” list in-place.
 */
export function parseVelkyHaj(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("article, .entry-content, main, body").text().replace(/\s+/g, " ");
  const year = seasonYearFromHtml(html);
  const seen = new Set<string>();
  const dates: string[] = [];

  const block = text.match(
    /Termíny závodů:\s*(.+?)(?:Propozice|O lokalitě|$)/i,
  )?.[1];
  if (block) {
    const re = new RegExp(`(\\d{1,2})\\.\\s*(${CZ_MONTH_NAME_RE})`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) {
      const iso = namedDayToIso(m[1]!, m[2]!, year);
      if (iso) dates.push(iso);
    }
  }

  if (dates.length < 2) {
    const fromFiles = [
      ...html.matchAll(/(\d{1,2})[._-](\d{1,2})[._-](20\d{2}|\d{2})/g),
    ];
    for (const m of fromFiles) {
      const mo = Number(m[2]);
      const d = Number(m[1]);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      if (y < 2025 || y > new Date().getFullYear() + 1) continue;
      dates.push(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }

  const unique = [...new Set(dates)].sort();
  const events: ParsedEvent[] = [];
  unique.forEach((startDate, i) => {
    const externalId = `velky-haj-${startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);
    events.push({
      externalId,
      name: `O Pohár MČ Praha 4 — ${i + 1}. kolo Velký Háj`,
      startDate,
      placeText: "Praha — Velký Háj",
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "O Pohár MČ Praha 4",
      seriesSlug: "pohar-mc-praha-4",
      seriesWebsite: "https://skvelopraha.cz/velky-haj/",
      sourceUrl: url,
      websiteUrl: "https://skvelopraha.cz/velky-haj/",
      confidence: 0.86,
    });
  });
  return events;
}

const VAN_GILLERN_LAT = 49.8891081;
const VAN_GILLERN_LNG = 14.5650803;
const VAN_GILLERN_SITE = "http://vangillerncup.cz";

/**
 * Van Gillern Cup — one-day family MTB (adults + kids) in Kamenice u Prahy.
 * Date lives on the homepage (“Neděle 6.září”); coords on /propozice/.
 */
export function parseVanGillern(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("article, .entry-content, main, body").text().replace(/\s+/g, " ");
  const yearMatch = text.match(/Van\s*Gillern\s*Cup\s*(20\d{2})/i);
  const year = yearMatch ? Number(yearMatch[1]) : seasonYearFromHtml(html);
  const dayM = text.match(/(\d{1,2})\.\s*(září|zari)/i);
  if (!dayM) return [];
  const startDate = namedDayToIso(dayM[1]!, dayM[2]!, year);
  if (!startDate) return [];

  let registrationUrl = "http://vangillerncup.cz/wordpress/registrace/";
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/eztiming\.eu\/prihlasky/i.test(href)) registrationUrl = href.split("?")[0]!;
  });

  const coordM = text.match(/(\d{2}\.\d+)\s*N[,\s]+(\d{2}\.\d+)\s*E/i);

  return [
    {
      externalId: `van-gillern-${startDate}`,
      name: `Van Gillern Cup ${year}`,
      startDate,
      placeText: "Kamenice u Prahy — Těptín",
      countryHint: "CZ",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "Van Gillern Cup",
      seriesSlug: "van-gillern-cup",
      seriesWebsite: VAN_GILLERN_SITE,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: VAN_GILLERN_SITE,
      registrationUrl,
      regulationsUrl: `${VAN_GILLERN_SITE.replace(/\/$/, "")}/wordpress/propozice/`,
      lat: coordM ? Number(coordM[1]) : VAN_GILLERN_LAT,
      lng: coordM ? Number(coordM[2]) : VAN_GILLERN_LNG,
      confidence: 0.92,
    },
  ];
}

const K_KOREN_LAT = 50.04139;
const K_KOREN_LNG = 15.28417;
const K_KOREN_SITE = "https://www.k-koren.cz";

/**
 * Konárovický kořen — one-day family MTB (balance-bike kids through masters)
 * at the fire-station grounds in Konárovice. Date lives on the homepage
 * (“Těšíme se na vás 27. září 2026”); do not parse /online-prihlasky/
 * (cancellation / close dates).
 *
 * Do not use `\b` after `září` — `í` is non-`\w` so the boundary never matches.
 */
export function parseKonarovickyKoren(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("article, .entry-content, main, body").text().replace(/\s+/g, " ");
  const yearMatch = text.match(/(\d{1,2})\.\s*(září|zari)\s*(20\d{2})/i);
  const year = yearMatch ? Number(yearMatch[3]) : seasonYearFromHtml(html);
  const dayM =
    text.match(/těšíme se na vás\s+(\d{1,2})\.\s*(září|zari)/i) ||
    text.match(/(\d{1,2})\.\s*(září|zari)\s*20\d{2}\s+na\s+\d/i) ||
    text.match(/(\d{1,2})\.\s*(září|zari)\s*20\d{2}/i);
  if (!dayM) return [];
  const startDate = namedDayToIso(dayM[1]!, dayM[2]!, year);
  if (!startDate) return [];

  return [
    {
      externalId: `k-koren-${startDate}`,
      name: `Konárovický kořen ${year}`,
      startDate,
      placeText: "Konárovice — hasičské hřiště",
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "Konárovický kořen",
      seriesSlug: "konarovicky-koren",
      seriesWebsite: K_KOREN_SITE,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: K_KOREN_SITE,
      registrationUrl: `${K_KOREN_SITE}/online-prihlasky/`,
      regulationsUrl: `${K_KOREN_SITE}/kategorie/`,
      lat: K_KOREN_LAT,
      lng: K_KOREN_LNG,
      confidence: 0.92,
    },
  ];
}

const PPK_REGISTRATION =
  "https://hynekmusil.cz/resreg/?designindex=data/registry.php&seiresepyt=ppk&dohzormhenyh=&swordssapll=&rebmunyavd=0&langtext=";

function parsePpkRacesJs(sourceUrl: string, js: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /\{\s*day:\s*'[^']*'\s*,\s*month:\s*'[^']*'\s*,\s*date:\s*'(20\d{2}-\d{2}-\d{2})'\s*,\s*name:\s*'([^']+)'\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js))) {
    const startDate = m[1]!;
    const place = m[2]!.replace(/\s+/g, " ").trim();
    if (!place) continue;
    if (/večírek|vecirek|vyhlášení|vyhlaseni|párty|party/i.test(place)) continue;
    const externalId = `ppkbike-${startDate}-${normalizeName(place)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    events.push({
      externalId,
      name: `PPKBIKE — ${place}`,
      startDate,
      placeText: place,
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "PPKBIKE",
      seriesSlug: "ppkbike",
      seriesWebsite: "https://ppkbike.cz/",
      sourceUrl,
      websiteUrl: "https://ppkbike.cz/",
      registrationUrl: PPK_REGISTRATION,
      confidence: 0.9,
    });
  }
  return events;
}

function pekloDate(raw: string): { start: string; end?: string } | null {
  return parseCzIso(raw) ?? (parseCzNamed(raw) ? { start: parseCzNamed(raw)! } : null);
}

function pekloDiscipline(name: string): Discipline[] {
  const t = name.toLowerCase();
  if (/\bxco\b/.test(t)) return ["xco"];
  if (/marat|xcm|fofr|sebnitz/.test(t)) return ["xcm"];
  return ["xco"];
}

function parsePekloTable(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const racePages = new Map<number, string>();
  $('a[href*="/rocnik-"][href*="-zavod"]').each((_, a) => {
    const href = $(a).attr("href") || "";
    const n = href.match(/\/(\d)-zavod/i)?.[1];
    if (!n) return;
    try {
      racePages.set(Number(n), new URL(href, url).toString());
    } catch {
      /* ignore */
    }
  });

  $("table tbody tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length < 3) return;
    const dateRaw = $tds.eq(0).text().replace(/\s+/g, " ").trim();
    const name = $tds.eq(1).text().replace(/\s+/g, " ").trim();
    const place = $tds.eq(2).text().replace(/\s+/g, " ").trim();
    if (!name || /cel[yý]\s+seri[aá]l|t[yý]mov[aá]\s+sout[eě][zž]/i.test(name)) return;
    const dates = pekloDate(dateRaw);
    if (!dates || !place) return;
    const regHref = ($tds.eq(3).find("a[href]").attr("href") || "").trim();
    const roundHint = $tds
      .eq(3)
      .text()
      .match(/(\d)\.\s*z[aá]vod/i)?.[1];
    const round = roundHint ? Number(roundHint) : events.length + 1;
    const websiteUrl = racePages.get(round) || url;
    const registrationUrl = /^https?:\/\//i.test(regHref) ? regHref : undefined;
    const countryHint = /n[eě]mecko|germany|sebnitz/i.test(place) ? "DE" : "CZ";
    const externalId = `peklo-severu-${dates.start}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);
    events.push({
      externalId,
      name: `Peklo Severu — ${name}`,
      startDate: dates.start,
      placeText: place.replace(/\s*\(.*\)\s*$/, "").trim(),
      countryHint,
      discipline: pekloDiscipline(name),
      audience: "mixed",
      seriesName: "Peklo Severu",
      seriesSlug: "peklo-severu",
      seriesWebsite: "https://www.pekloseveru.cz/cz/",
      sourceUrl: websiteUrl,
      websiteUrl,
      registrationUrl,
      confidence: 0.92,
    });
  });
  return events;
}

/**
 * Official calendar is `/cz/rocnik-YYYY/propozice-serialu/` (named dates + XCO/maraton).
 * `/cz/registrace/` has the same rounds plus nazavody / timing links.
 */
export async function parsePekloSeveru(url: string, html: string): Promise<ParsedEvent[]> {
  const events = parsePekloTable(url, html);
  const needsReg =
    events.some((e) => !e.registrationUrl) && /propozice|regulations/i.test(url);
  if (!needsReg) return events;
  const fetched = await fetchText("https://www.pekloseveru.cz/cz/registrace/");
  if (!fetched.ok || !fetched.text) return events;
  const byDate = new Map(
    parsePekloTable("https://www.pekloseveru.cz/cz/registrace/", fetched.text).map((e) => [
      e.startDate,
      e,
    ]),
  );
  return events.map((e) => {
    const extra = byDate.get(e.startDate);
    if (!extra?.registrationUrl) return e;
    return { ...e, registrationUrl: extra.registrationUrl };
  });
}

const JESENICKY_SNEK_SITE = "https://jesenickysnek.cz";
const JESENICKY_SNEK_REGS =
  "https://api.xathlo.com/storage/v1/object/public/org-1/snek2026.pdf";

function snekAbsUrl(href: string, origin: string): string | undefined {
  try {
    return new URL(href, origin).toString();
  } catch {
    return undefined;
  }
}

/**
 * Jesenický šnek — Jeseníky club MTB (XC + kids šneček). Homepage cards are
 * MUI `<a href="/event/N">` with a date-only `<time datetime="YYYY-MM-DD">`.
 * News posts use ISO datetimes with a clock — skip those.
 */
export function parseJesenickySnek(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  let origin = JESENICKY_SNEK_SITE;
  try {
    origin = new URL(url).origin;
  } catch {
    /* keep default */
  }
  const onEventPage = /\/event\/\d+\/?$/.test(url.split("?")[0] || "");

  $("a[href*='/event/']").each((_, link) => {
    const $link = $(link);
    const href = $link.attr("href") || "";
    if (!/\/event\/\d+/.test(href)) return;

    const name = $link.find("h1, h2, h3, h4, h5").first().text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;
    if (/^(aktuality|závody|zavody|jesenický šnek)$/i.test(name)) return;

    const $time = $link
      .find("time")
      .filter((_, el) => /^\d{4}-\d{2}-\d{2}$/.test(($(el).attr("datetime") || "").trim()))
      .first();
    const startDate = ($time.attr("datetime") || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;

    let placeText = "";
    $time.nextAll("span").each((_, span) => {
      const t = $(span).text().replace(/[,\s]+/g, " ").trim();
      if (t.length > 2 && !placeText) placeText = t;
    });
    if (!placeText) {
      const blob = $link.text().replace(/\s+/g, " ");
      placeText = blob.match(/20\d{2}-\d{2}-\d{2},\s*([^,]+)/)?.[1]?.trim() ?? "";
    }
    if (!placeText) return;

    const websiteUrl =
      snekAbsUrl(href, origin)?.replace(/\/$/, "") ||
      (onEventPage ? url.split("?")[0] : JESENICKY_SNEK_SITE);

    let registrationUrl: string | undefined;
    $link.find("a[href]").each((_, a) => {
      const h = $(a).attr("href") || "";
      if (/docs\.google\.com\/forms|powerofmotion\.cz|nazavody\.cz/i.test(h)) {
        registrationUrl = snekAbsUrl(h, origin) ?? h;
      }
    });
    if (!registrationUrl && onEventPage) {
      $("a[href]").each((_, a) => {
        const h = $(a).attr("href") || "";
        if (/docs\.google\.com\/forms|powerofmotion\.cz|nazavody\.cz/i.test(h)) {
          registrationUrl = snekAbsUrl(h, origin) ?? h;
        }
      });
    }

    const externalId = `jesenicky-snek-${startDate}-${normalizeName(name)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name,
      startDate,
      placeText,
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "Jesenický šnek",
      seriesSlug: "jesenicky-snek",
      seriesWebsite: JESENICKY_SNEK_SITE,
      sourceUrl: url.split("?")[0]!,
      websiteUrl,
      registrationUrl,
      regulationsUrl: JESENICKY_SNEK_REGS,
      confidence: 0.9,
    });
  });

  if (!events.length && onEventPage) {
    $("h1, h3, h4").each((_, heading) => {
      const name = $(heading).text().replace(/\s+/g, " ").trim();
      if (!name || name.length < 3) return;
      if (/^(aktuality|závody|zavody|jesenický šnek)$/i.test(name)) return;

      const $scope = $(heading).parent();
      const $time = $("time")
        .filter((_, el) => /^\d{4}-\d{2}-\d{2}$/.test(($(el).attr("datetime") || "").trim()))
        .first();
      const startDate = ($time.attr("datetime") || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;

      let placeText = "";
      $time.nextAll("span").each((_, span) => {
        const t = $(span).text().replace(/[,\s]+/g, " ").trim();
        if (t.length > 2 && !placeText) placeText = t;
      });
      if (!placeText) {
        const blob = $("body").text().replace(/\s+/g, " ");
        placeText = blob.match(/20\d{2}-\d{2}-\d{2},\s*([^,]+)/)?.[1]?.trim() ?? "";
      }
      if (!placeText) return;

      let registrationUrl: string | undefined;
      $("a[href]").each((_, a) => {
        const h = $(a).attr("href") || "";
        if (/docs\.google\.com\/forms|powerofmotion\.cz|nazavody\.cz/i.test(h)) {
          registrationUrl = snekAbsUrl(h, origin) ?? h;
        }
      });

      const externalId = `jesenicky-snek-${startDate}-${normalizeName(name)}`;
      if (seen.has(externalId)) return;
      seen.add(externalId);

      events.push({
        externalId,
        name,
        startDate,
        placeText,
        countryHint: "CZ",
        discipline: ["xco"],
        audience: "mixed",
        seriesName: "Jesenický šnek",
        seriesSlug: "jesenicky-snek",
        seriesWebsite: JESENICKY_SNEK_SITE,
        sourceUrl: url.split("?")[0]!,
        websiteUrl: url.split("?")[0],
        registrationUrl,
        regulationsUrl: JESENICKY_SNEK_REGS,
        confidence: 0.9,
      });
    });
  }

  return events;
}

/**
 * Pohár Plzeňského kraje MTB XCO — dates live in `ppk-races.js` (homepage grid is JS-rendered).
 */
export async function parsePpkBike(url: string, html: string): Promise<ParsedEvent[]> {
  if (/PPK_RACES\s*=/.test(html)) return parsePpkRacesJs(url, html);
  const fetched = await fetchText("https://ppkbike.cz/ppk-races.js");
  if (!fetched.ok || !fetched.text) return [];
  return parsePpkRacesJs(url, fetched.text);
}
