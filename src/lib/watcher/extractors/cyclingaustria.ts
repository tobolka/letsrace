import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

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

const CA_SKIP =
  /indoor|radball|kunstrad|hallenrad|e-?sport|pumptrack|kunstradsport|artistic|einrad/i;

function mapDisc(raw: string): Discipline[] {
  const t = raw.toLowerCase();
  if (/\bcyclocross|querfeldein|\bcx\b/.test(t)) return ["cx"];
  if (/\benduro\b/.test(t)) return ["enduro"];
  if (/\bdownhill|\bdh\b/.test(t)) return ["dh"];
  if (/\bgravel\b/.test(t)) return ["gravel"];
  if (/\bxcm|marathon|maraton/.test(t)) return ["xcm"];
  if (/\bxcc|short.?track|eliminator/.test(t)) return ["xcc"];
  if (/\bxco|cross.?country/.test(t)) return ["xco"];
  if (/\bkriterium/.test(t)) return ["criterium"];
  if (/\beinzelzeitfahren|mannschaftszeitfahren|\bezf\b|\bmzf\b/.test(t)) return ["tt"];
  if (/\bbergrennen|hillclimb|hügelwelt/.test(t)) return ["hill_climb"];
  if (/\bstraß|strasse|straßenrennen|radsaison|etappenrennen|omnium/.test(t)) {
    return ["road"];
  }
  if (/\bbmx/.test(t)) return ["bmx"];
  if (/\bhillclimb|berg/.test(t)) return ["hill_climb"];
  return ["mtb"];
}

function caSeries(
  name: string,
  discRaw: string,
): { seriesName: string; seriesSlug: string; seriesWebsite: string } | undefined {
  const t = `${name} ${discRaw}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const site = "https://cyclingaustria.at/news/allgemein/cycling-austria-cups-2026";
  if (/gravity|auner/.test(t)) {
    return {
      seriesName: "Austrian Gravity Series",
      seriesSlug: "austrian-gravity-series",
      seriesWebsite: "https://www.lines-mag.at/austrian-gravity-series/",
    };
  }
  if (/youngsters cup|grazer youngsters/.test(t)) {
    return {
      seriesName: "Austrian Youngsters Cup",
      seriesSlug: "austrian-youngsters-cup",
      seriesWebsite: site,
    };
  }
  if (/junior bike cup|\bjbc\b/.test(t)) {
    return {
      seriesName: "Junior Bike Cup",
      seriesSlug: "junior-bike-cup",
      seriesWebsite: "https://www.juniorbikecup.at/",
    };
  }
  if (/amateur cup|amateur mtb|sportklasse/.test(t)) {
    return {
      seriesName: "Sportklasse Cup",
      seriesSlug: "sportklasse-cup",
      seriesWebsite: "http://www.sportklasse-cup.at/",
    };
  }
  if (/ktm junior/.test(t)) {
    return {
      seriesName: "KTM Junior Challenge",
      seriesSlug: "ktm-junior-challenge",
      seriesWebsite: "https://www.mountainbike-challenge.at/",
    };
  }
  if (/nachwuchscup/.test(t)) {
    return {
      seriesName: "Österreichischer MTB Nachwuchscup",
      seriesSlug: "at-mtb-nachwuchscup",
      seriesWebsite: site,
    };
  }
  return undefined;
}

/** Clean `?page=2` siblings — the site's own pagination hrefs are malformed. */
export function cyclingAustriaPageUrls(url: string): string[] {
  try {
    const u = new URL(url);
    if (!/kalender/i.test(u.pathname)) return [];
    const page = Number(u.searchParams.get("page") || "1");
    if (page !== 1) return [];
    const out: string[] = [];
    for (let p = 2; p <= 5; p++) {
      const next = new URL(u.toString());
      if (!next.searchParams.get("view")) next.searchParams.set("view", "events");
      next.searchParams.set("page", String(p));
      out.push(next.toString());
    }
    const sparten = (u.searchParams.get("sparten") || "").toLowerCase();
    if (sparten === "mtb" || !sparten) {
      const cx = new URL("https://www.cyclingaustria.at/kalender");
      cx.searchParams.set("sparten", "cyclocross");
      cx.searchParams.set("view", "events");
      out.push(cx.toString());
    }
    if (sparten === "mtb") {
      const all = new URL("https://www.cyclingaustria.at/kalender");
      all.searchParams.set("view", "events");
      out.push(all.toString());
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

/**
 * ÖRV Cycling Austria calendar (`cyclingaustria.at/kalender`).
 * Cards: `a.om_card` with `data-date` on the wrapper and German weekday heading.
 */
export function parseCyclingAustria(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("div[data-date]").each((_, wrap) => {
    const $wrap = $(wrap);
    const iso = ($wrap.attr("data-date") || "").slice(0, 10);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(iso)) return;
    const $a = $wrap.find("a.om_card").first();
    const href = $a.attr("href");
    const name = $wrap.find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 4) return;
    if (/abgesagt|cancelled|abbruch/i.test(name)) return;

    const discRaw = $wrap.attr("data-disziplin") || $wrap.attr("class") || "";
    const blob = `${name} ${discRaw}`;
    if (CA_SKIP.test(blob) || /\bbahn\b/i.test(blob)) return;

    const verein = $wrap.find(".event-verein").text().replace(/\s+/g, " ").trim();
    const heading = $wrap.find(".uk-heading-small").text().replace(/\s+/g, " ").trim();
    // "Sa, 15. August 2026 | …" — confirm year
    const named = heading.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(20\d{2})/);
    let startDate = iso;
    if (named) {
      const mo =
        DE_MONTHS[named[2]!.toLowerCase()] ||
        DE_MONTHS[
          named[2]!.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        ];
      if (mo) startDate = `${named[3]}-${mo}-${named[1]!.padStart(2, "0")}`;
    }

    let abs = url;
    if (href) {
      try {
        abs = new URL(href.replace(/&amp;/g, "&"), url).toString();
      } catch {
        /* keep */
      }
    }

    const id = abs.match(/id=([A-F0-9]+)/i)?.[1] || normalizeName(name);
    const externalId = `oerv-${id}-${startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const region = ($wrap.attr("class") || "")
      .split(/\s+/)
      .find((c) =>
        /^(Wien|Niederösterreich|Oberösterreich|Steiermark|Tirol|Salzburg|Kärnten|Vorarlberg|Burgenland)$/i.test(
          c,
        ),
      );

    const series = caSeries(name, discRaw);
    events.push({
      externalId,
      name,
      startDate,
      placeText: [verein, region].filter(Boolean).join(" — ") || region || "Austria",
      countryHint: "AT",
      discipline: mapDisc(discRaw + " " + name),
      audience: /nachwuchs|jugend|u1[13579]|kids|kinder|youngsters/i.test(blob)
        ? "youth"
        : "mixed",
      sourceUrl: abs,
      websiteUrl: abs,
      confidence: 0.82,
      ...series,
    });
  });

  const pages = cyclingAustriaPageUrls(url);
  if (pages.length && events[0]) {
    events[0] = {
      ...events[0],
      childUrls: [...new Set([...(events[0].childUrls ?? []), ...pages])],
    };
  }

  return events;
}
