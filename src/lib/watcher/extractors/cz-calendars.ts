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
        sourceUrl: url,
        websiteUrl: card.href,
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

    const infoHref = $tr.find("td.links a[href]").first().attr("href");
    let websiteUrl = "https://www.poharmtb.cz/cross-country";
    if (infoHref) {
      try {
        websiteUrl = new URL(infoHref, url).toString();
      } catch {
        /* keep */
      }
    }

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
      sourceUrl: url,
      websiteUrl,
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

    const href = $el.find(".nadpis a").attr("href");
    let websiteUrl = originOf(url);
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }

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
      seriesWebsite: originOf(url) + "/",
      sourceUrl: url,
      websiteUrl,
      confidence: 0.86,
    });
  });

  return events;
}

/** Pražský MTB pohár — propozice headings `N.kolo – DD. month YYYY, Place`. */
export function parsePrahaMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("article, .entry-content, main, body").text();
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d+)\.\s*kolo\s*[–-]\s*(\d{1,2})\.\s*([A-Za-záčďéěíňóřšťúůýž]+)\s*(20\d{2})\s*,\s*([A-Za-záčďéěíňóřšťúůýž0-9 ]{2,40})/gi;
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
      placeText: /motol|kbely|letňany|letnany|zličín|zlicin|libuš|libus|beckov/i.test(place)
        ? `Praha — ${place}`
        : place,
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

/** Czech Enduro Series — official `/zavody/` listing. */
export function parseEnduroSerie(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $('a[href*="/zavody/"]').each((_, a) => {
    const href = $(a).attr("href");
    const label = $(a).text().replace(/\s+/g, " ").trim();
    if (!href || !label) return;
    if (/\/zavody\/?$/i.test(href)) return;
    const dates = parseCzIso(label) || parseCzNamed(label);
    const start =
      typeof dates === "string" ? dates : dates?.start;
    // Date often sits in the link text: "Enduro Race Kouty 24.5."
    const dm = label.match(/(\d{1,2})\.\s*(\d{1,2})\.?/);
    const year = new Date().getFullYear();
    const startDate =
      start ||
      (dm ? `${year}-${dm[2]!.padStart(2, "0")}-${dm[1]!.padStart(2, "0")}` : null);
    if (!startDate) return;

    let abs: string;
    try {
      abs = new URL(href, url).toString();
    } catch {
      return;
    }
    const slug = abs.replace(/\/$/, "").split("/").pop() || normalizeName(label);
    const externalId = `enduroserie-${slug}-${startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const name = label.replace(/\s+\d{1,2}\.\s*\d{1,2}\.?\s*$/, "").trim();
    events.push({
      externalId,
      name,
      startDate,
      placeText: name.replace(/^Enduro (Race|Challenge)\s+/i, "").trim() || name,
      countryHint: /czarna|gora/i.test(name) ? "PL" : "CZ",
      discipline: ["enduro"],
      audience: "mixed",
      seriesName: "Czech Enduro Series",
      seriesSlug: "czech-enduro-series",
      seriesWebsite: "https://www.enduroserie.cz/",
      sourceUrl: url,
      websiteUrl: abs,
      confidence: 0.88,
    });
  });

  return events;
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

/** cyklokros.cz — watch the page; 2026/27 calendar is still “bude upřesněno”. */
export function parseCyklokros(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

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
        seriesWebsite: "https://www.cyklokros.cz/",
        sourceUrl: url,
        websiteUrl: url,
        confidence: 0.7,
      });
    });

  return events;
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
      try {
        websiteUrl = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }

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
      sourceUrl: url.split("#")[0]!,
      websiteUrl,
      confidence: 0.9,
    });
  });

  return events;
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
      sourceUrl: url.split("?")[0]!,
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
      sourceUrl: url,
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
