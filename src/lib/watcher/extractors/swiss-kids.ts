import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

const EN_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const DE_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  marz: "03",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function enRange(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ");
  const months = "January|February|March|April|May|June|July|August|September|October|November|December";
  const range = t.match(
    new RegExp(
      `(${months})\\s+(\\d{1,2}),\\s*(20\\d{2})\\s*[–-]\\s*(${months})\\s+(\\d{1,2}),\\s*(20\\d{2})`,
      "i",
    ),
  );
  if (range) {
    const m1 = EN_MONTHS[range[1]!.toLowerCase()];
    const m2 = EN_MONTHS[range[4]!.toLowerCase()];
    if (!m1 || !m2) return null;
    return {
      start: `${range[3]}-${m1}-${range[2]!.padStart(2, "0")}`,
      end: `${range[6]}-${m2}-${range[5]!.padStart(2, "0")}`,
    };
  }
  const one = t.match(new RegExp(`(${months})\\s+(\\d{1,2}),\\s*(20\\d{2})`, "i"));
  if (!one) return null;
  const mo = EN_MONTHS[one[1]!.toLowerCase()];
  if (!mo) return null;
  return { start: `${one[3]}-${mo}-${one[2]!.padStart(2, "0")}` };
}

function deDayMonth(raw: string, year: number): string | null {
  const m = raw.replace(/\s+/g, " ").match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)/);
  if (!m) return null;
  const mo = DE_MONTHS[m[2]!.toLowerCase()] || DE_MONTHS[fold(m[2]!)];
  if (!mo) return null;
  return `${year}-${mo}-${m[1]!.padStart(2, "0")}`;
}

function push(events: ParsedEvent[], seen: Set<string>, ev: ParsedEvent): void {
  if (seen.has(ev.externalId)) return;
  seen.add(ev.externalId);
  if (ev.endDate && ev.endDate === ev.startDate) delete ev.endDate;
  events.push(ev);
}

function sbcPlace(title: string): string {
  const paren = title.match(/\(([^)]+)\)/);
  if (paren) return paren[1]!.replace(/\s+[A-Z]{2}\s*$/, "").trim();
  const cleaned = title
    .replace(/^Etappe\s+/i, "")
    .replace(/,?\s*Skoda Swiss Bike Cup.*$/i, "")
    .trim();
  const comma = cleaned.split(",")[0]!.trim();
  return comma.replace(/^GP\s+/i, "").trim() || cleaned;
}

function valaisPlace(name: string): string {
  const t = name.replace(/\s+/g, " ").trim();
  if (/pfynwald|leuker/i.test(t)) return "Pfynwald";
  if (/crans|flow'er|power/i.test(t)) return "Crans-Montana";
  if (/bettmeralp/i.test(t)) return "Bettmeralp";
  if (/evol/i.test(t)) return "Evolène";
  if (/blitzingen/i.test(t)) return "Blitzingen";
  if (/grimentz|raidy/i.test(t)) return "Grimentz";
  if (/simplon/i.test(t)) return "Simplon";
  if (/zermatt/i.test(t)) return "Zermatt";
  if (/vercorin/i.test(t)) return "Vercorin";
  if (/zinal|besso/i.test(t)) return "Zinal";
  if (/morgins/i.test(t)) return "Morgins";
  if (/kinder cc/i.test(t)) return "Valais";
  return t.split(/[-–]/)[0]!.trim();
}

function valaisDate(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const range = t.match(/(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (range) {
    return {
      start: `${range[4]}-${range[3]!.padStart(2, "0")}-${range[1]!.padStart(2, "0")}`,
      end: `${range[4]}-${range[3]!.padStart(2, "0")}-${range[2]!.padStart(2, "0")}`,
    };
  }
  const one = t.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (!one) return null;
  return { start: `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}` };
}

function valaisDisc(raw: string): Discipline[] {
  const t = raw.toLowerCase();
  if (/downhill|\bdh\b/.test(t)) return ["dh"];
  if (/enduro/.test(t)) return ["enduro"];
  if (/xco/.test(t)) return ["xco"];
  return ["mtb"];
}

/** Škoda Swiss Bike Cup — homepage etappe list, dates from stage pages. */
export async function parseSwissBikeCup(url: string, html: string): Promise<ParsedEvent[]> {
  const $ = cheerio.load(html);
  const hrefs: string[] = [];
  $('a[href*="/etappe/"]').each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    try {
      hrefs.push(new URL(href, url).toString().split("?")[0]!);
    } catch {
      /* ignore */
    }
  });
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (const href of [...new Set(hrefs)]) {
    const page = await fetchText(href);
    if (!page.ok) continue;
    const $p = cheerio.load(page.text);
    const title = ($p("title").first().text() || $p("h1").first().text()).replace(/\s+/g, " ").trim();
    const dates = enRange($p("body").text());
    if (!dates) continue;
    const place = sbcPlace(title);
    const kids = /moléson|moleson/i.test(`${place} ${title}`);
    push(events, seen, {
      externalId: `swiss-bike-cup-${dates.start}-${normalizeName(place)}`,
      name: `Škoda Swiss Bike Cup — ${place}`,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place,
      countryHint: "CH",
      discipline: ["xco"],
      audience: kids ? "kids" : "mixed",
      seriesName: "Škoda Swiss Bike Cup",
      seriesSlug: "skoda-swiss-bike-cup",
      seriesWebsite: "https://www.swissbikecup.ch/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: href,
      confidence: 0.9,
    });
  }
  return events;
}

/** Kids Bike Cup Valais/Wallis — profile cards. Skip road + Valiant GP (own series). */
export function parseValaisKidsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $(".profiles-item").each((_, el) => {
    const $el = $(el);
    const disc = $el.find(".profiles-stop").text().replace(/\s+/g, " ").trim();
    const name = $el.find("h4").first().text().replace(/\s+/g, " ").trim();
    const dateRaw = $el.find(".profiles-details p").first().text().replace(/\s+/g, " ").trim();
    if (!name || /valiant|pumptrack|rennrad|bambino|giron du rhône|course de côte|cyclosportive|speed\s*&\s*style|zermatt/i.test(`${disc} ${name}`)) {
      return;
    }
    if (/^rennrad/i.test(disc) && !/mtb|xco|enduro/i.test(disc)) return;
    const dates = valaisDate(dateRaw);
    if (!dates) return;
    const place = valaisPlace(name);
    const href = $el.find(".profiles-links a[href]").filter((_, a) => {
      const h = $(a).attr("href") || "";
      return /^https?:/i.test(h) && !/drive\.google|docs\.google|\.pdf($|\?)/i.test(h);
    }).first().attr("href");
    push(events, seen, {
      externalId: `valais-kids-${dates.start}-${normalizeName(place)}`,
      name: `Kids Bike Cup Valais — ${name.replace(/^Kids Bike Cup Valais\/Wallis\s*[–-]\s*/i, "")}`,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place,
      countryHint: "CH",
      discipline: valaisDisc(`${disc} ${name}`),
      audience: "kids",
      seriesName: "Kids Bike Cup Valais/Wallis",
      seriesSlug: "kids-bike-cup-valais",
      seriesWebsite: "https://valais-cycling.ch/de/kids-bike-cup-valais-wallis/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: href || url.split("?")[0]!,
      confidence: 0.88,
    });
  });
  return events;
}

/** Valiant GP kids DH — Valais qualifiers + Engelberg finale. */
export function parseValiantGp(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();

  if (host.includes("valais-cycling.ch")) {
    $(".profiles-item").each((_, el) => {
      const $el = $(el);
      const disc = $el.find(".profiles-stop").text();
      const name = $el.find("h4").first().text().replace(/\s+/g, " ").trim();
      const dateRaw = $el.find(".profiles-details p").first().text();
      if (!/valiant/i.test(name) && !/downhill/i.test(disc)) return;
      if (!/valiant/i.test(name)) return;
      const dates = valaisDate(dateRaw);
      if (!dates) return;
      const place = valaisPlace(name);
      push(events, seen, {
        externalId: `valiant-gp-${dates.start}-${normalizeName(place)}`,
        name: `Valiant GP — ${place}`,
        startDate: dates.start,
        placeText: place,
        countryHint: "CH",
        discipline: ["dh"],
        audience: "kids",
        seriesName: "Valiant GP",
        seriesSlug: "valiant-gp",
        seriesWebsite: "https://www.bikeclub-engelberg.ch/wp/valiant-gp/",
        sourceUrl: url.split("?")[0]!,
        websiteUrl: url.split("?")[0]!,
        confidence: 0.86,
      });
    });
    return events;
  }

  const text = $("body").text().replace(/\s+/g, " ");
  if (!/valiant/i.test(text)) return [];
  const named = text.match(/(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})/i);
  const dotted = text.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  const startDate = named
    ? deDayMonth(`${named[1]}. ${named[2]}`, Number(named[3]))
    : dotted
      ? `${dotted[3]}-${dotted[2]!.padStart(2, "0")}-${dotted[1]!.padStart(2, "0")}`
      : null;
  if (!startDate) return [];
  return [
    {
      externalId: `valiant-gp-${startDate}-engelberg`,
      name: "Valiant GP — Engelberg",
      startDate,
      placeText: "Engelberg",
      countryHint: "CH",
      discipline: ["dh"],
      audience: "kids",
      seriesName: "Valiant GP",
      seriesSlug: "valiant-gp",
      seriesWebsite: "https://www.bikeclub-engelberg.ch/wp/valiant-gp/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}

/** Bike Kingdom Kids Cup — Lenzerheide + Chur. */
export function parseBikeKingdomKidsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  if (!/kids cup/i.test(text)) return [];
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const rounds: { start: string; end?: string; place: string; hint: RegExp }[] = [
    { start: "2026-06-07", place: "Lenzerheide", hint: /7 June 2026|June 7,?\s*2026/i },
    { start: "2026-08-16", place: "Chur", hint: /16 August 2026|August 16,?\s*2026/i },
    {
      start: "2026-09-12",
      end: "2026-09-13",
      place: "Lenzerheide",
      hint: /12 and 13 September|September 12/i,
    },
  ];
  for (const row of rounds) {
    if (!row.hint.test(text)) continue;
    push(events, seen, {
      externalId: `bike-kingdom-${row.start}-${normalizeName(row.place)}`,
      name: `Bike Kingdom Kids Cup — ${row.place}`,
      startDate: row.start,
      endDate: row.end,
      placeText: row.place,
      countryHint: "CH",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Bike Kingdom Kids Cup",
      seriesSlug: "bike-kingdom-kids-cup",
      seriesWebsite: "https://www.bikekingdom.ch/en/Events/Kids-Cup",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.87,
    });
  }
  return events;
}

/** bundicycling Kids-Cup (Graubünden) — MTB rounds only. */
export function parseBundiKidsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const rounds: { re: RegExp; start: string; place: string }[] = [
    { re: /4\.\s*April[\s\S]{0,220}Arbon/i, start: "2026-04-04", place: "Arbon" },
    { re: /16\.\s*Mai[\s\S]{0,220}Ilanz/i, start: "2026-05-16", place: "Ilanz" },
    { re: /6\.\s*Juni[\s\S]{0,220}Obersaxen/i, start: "2026-06-06", place: "Obersaxen" },
    { re: /15\.\s*August[\s\S]{0,220}Donath/i, start: "2026-08-15", place: "Donat" },
    { re: /9\.\s*September[\s\S]{0,220}(?:Bikeschüali|Chur)/i, start: "2026-09-09", place: "Chur" },
  ];
  for (const row of rounds) {
    if (!row.re.test(text)) continue;
    push(events, seen, {
      externalId: `bundi-kids-${row.start}-${normalizeName(row.place)}`,
      name: `bundicycling Kids-Cup — ${row.place}`,
      startDate: row.start,
      placeText: row.place,
      countryHint: "CH",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "bundicycling Kids-Cup",
      seriesSlug: "bundicycling-kids-cup",
      seriesWebsite: "https://www.brvinfo.ch/bundicycling-kidscup/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.85,
    });
  }
  return events;
}

/** Vittoria-Fischer MTB-Cup — official race list. */
export function parseVittoriaCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("h2, h3").each((_, el) => {
    const place = $(el).text().replace(/\s+/g, " ").trim();
    if (!/langendorf|aesch|seon|sch[öo]tz|lostorf|h[äa]gglingen/i.test(place)) return;
    const after = $(el).nextAll().slice(0, 6).text();
    const m = after.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
    if (!m) return;
    const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const href = $(el).closest("a").attr("href") || $(el).find("a").attr("href");
    let websiteUrl = url.split("?")[0]!;
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString().split("?")[0]!;
      } catch {
        /* keep */
      }
    }
    push(events, seen, {
      externalId: `vittoria-${startDate}-${normalizeName(place)}`,
      name: `Vittoria-Fischer MTB-Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "CH",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "Vittoria-Fischer MTB-Cup",
      seriesSlug: "vittoria-fischer-mtb-cup",
      seriesWebsite: "https://mtb-cup.ch/en/race",
      sourceUrl: url.split("?")[0]!,
      websiteUrl,
      confidence: 0.9,
    });
  });
  return events;
}

/** Eiger Bike Challenge kids race — Grindelwald. */
export function parseEigerKidsRace(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!m) return [];
  const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return [
    {
      externalId: `eiger-kids-${startDate}`,
      name: "Eiger Bike Challenge — Kids Race",
      startDate,
      placeText: "Grindelwald",
      countryHint: "CH",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Eiger Bike Challenge",
      seriesSlug: "eiger-bike-challenge",
      seriesWebsite: "https://www.eigerbike.ch/de/kids-race/informationen/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}
