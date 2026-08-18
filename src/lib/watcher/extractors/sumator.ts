import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { inferRaceLevel } from "@/lib/race-level";
import { isAggregatorUrl } from "@/lib/watcher/public-url";

const DISC_MAP: Record<string, Discipline> = {
  xc: "xco",
  xco: "xco",
  xcc: "xcc",
  xcm: "xcm",
  silnice: "road",
  road: "road",
  dh: "dh",
  enduro: "enduro",
  gravel: "gravel",
  mtbo: "other",
  cyklokros: "cx",
  cx: "cx",
  bmx: "bmx",
  track: "track",
  "4x": "other",
  event: "other",
  akce: "other",
};

function yearFromUrl(url: string): number {
  const m = url.match(/date_from=(\d{1,2})-(\d{4})/) || url.match(/(20\d{2})/);
  if (m) {
    const y = Number(m[2] || m[1]);
    if (y >= 2020 && y <= 2100) return y;
  }
  return new Date().getFullYear();
}

function mapDisc(raw: string | undefined): Discipline | undefined {
  if (!raw) return undefined;
  return DISC_MAP[raw.toLowerCase().trim()] ?? undefined;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "https://sumator.cz";
  }
}

export function isSumatorHost(host: string): boolean {
  const h = host.replace(/^www\./i, "").toLowerCase();
  return h.includes("sumator.cz") || h.includes("jihoceskymtbpohar.cz");
}

function parseSumatorHtml(url: string, html: string, year: number): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const origin = originOf(url);

  $(".rd-row").each((_, el) => {
    const $row = $(el);
    const link =
      $row.find("a.rd-row__link").attr("href") || $row.find("a[href*='/race/']").attr("href");
    if (!link || !/\/race\/[a-z0-9-]+/i.test(link)) return;

    const titleAttr = $row.find("a.rd-row__link").attr("title")?.trim();
    const name =
      titleAttr ||
      $row.find(".rd-row__name").clone().children().remove().end().text().replace(/\s+/g, " ").trim() ||
      $row.find(".rd-row__name").text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;

    const dateText = $row.find(".rd-row__date strong").text().replace(/\s+/g, " ").trim();
    const dm = dateText.match(/(\d{1,2})\.\s*(\d{1,2})\.?/);
    if (!dm) return;
    const slugYear = link.match(/-(\d{4})(?:\?|$)/)?.[1];
    const y = slugYear && Number(slugYear) >= 2020 ? Number(slugYear) : year;
    const startDate = `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;

    const sub = $row.find(".rd-row__sub").text().replace(/\s+/g, " ").trim();
    const placeFromSub = sub.split("·")[0]?.trim();
    const discRaw = sub.split("·")[1]?.trim();
    const place =
      $row.find(".rd-row__place").text().replace(/\s+/g, " ").trim() || placeFromSub || "Czechia";

    const abs = link.startsWith("http")
      ? link.split("?")[0]
      : `${origin}${link.split("?")[0]}`;
    const disc = mapDisc(discRaw);
    void inferRaceLevel(`${name} ${sub}`);

    const placeCc = (() => {
      const m = place.match(
        /\((south africa|spain|portugal|belgium|france|italy|germany|austria|slovakia|poland|switzerland|netherlands|slovenia|croatia|hungary|denmark)\)/i,
      );
      if (!m) return "CZ";
      const map: Record<string, string> = {
        "south africa": "ZA",
        spain: "ES",
        portugal: "PT",
        belgium: "BE",
        france: "FR",
        italy: "IT",
        germany: "DE",
        austria: "AT",
        slovakia: "SK",
        poland: "PL",
        switzerland: "CH",
        netherlands: "NL",
        slovenia: "SI",
        croatia: "HR",
        hungary: "HU",
        denmark: "DK",
      };
      return map[m[1].toLowerCase()] ?? "CZ";
    })();

    events.push({
      externalId: `sumator-${normalizeName(name)}-${startDate}`,
      name,
      startDate,
      placeText: place.slice(0, 80),
      countryHint: placeCc,
      discipline: disc ? [disc] : undefined,
      audience: /junior|žák|deti|děti|kids|talent/i.test(name) ? "kids" : "mixed",
      sourceUrl: abs,
      confidence: 0.85,
    });
  });

  return events;
}

const SOCIAL_HOST = /facebook\.com|instagram\.com|youtube\.|youtu\.be|tiktok\.com|x\.com|twitter\.com/i;

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Club homepage from an official outbound link — never Sumator or socials. */
export function officialSiteHome(url: string | undefined): string | null {
  if (!url || !isHttp(url) || isAggregatorUrl(url) || SOCIAL_HOST.test(url)) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    u.pathname = "/";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Official Web / Registrace / Propozice from Sumator race detail “Odkazy”. */
export function extractSumatorOfficialLinks(html: string): {
  websiteUrl?: string;
  registrationUrl?: string;
  regulationsUrl?: string;
  extraUrls: string[];
} {
  const $ = cheerio.load(html);
  let websiteUrl: string | undefined;
  let registrationUrl: string | undefined;
  let regulationsUrl: string | undefined;
  const extraUrls: string[] = [];

  const consider = (label: string, href: string) => {
    if (!isHttp(href) || isAggregatorUrl(href) || SOCIAL_HOST.test(href)) return;
    extraUrls.push(href);
    if (/^(web|www|stránka|stranka|homepage|home|oficiální web|oficialni web)$/i.test(label)) {
      websiteUrl = href;
    } else if (/registr|přihláš|prihlas|entry|anmeld|zapisy/i.test(label)) {
      registrationUrl = href;
    } else if (/propozic|regul|ausschreibung|nennung/i.test(label)) {
      regulationsUrl = href;
    }
  };

  $(".rd-card__title").each((_, el) => {
    if (!/odkazy/i.test($(el).text())) return;
    $(el)
      .parent()
      .find("a[href]")
      .each((__, a) => {
        consider($(a).text().replace(/\s+/g, " ").trim(), ($(a).attr("href") || "").trim());
      });
  });

  if (!websiteUrl) {
    $("a.rd-btn").each((_, a) => {
      consider($(a).text().replace(/\s+/g, " ").trim(), ($(a).attr("href") || "").trim());
    });
  }

  return { websiteUrl, registrationUrl, regulationsUrl, extraUrls: [...new Set(extraUrls)] };
}

function parseKm(raw: string): number | undefined {
  const m = raw.replace(/\s/g, "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parseAgeRange(text: string): { ageMin?: number; ageMax?: number } {
  const range = text.match(/(\d+)\s*[–-]\s*(\d+)\s*let/i);
  if (range) return { ageMin: Number(range[1]), ageMax: Number(range[2]) };
  const plus = text.match(/(\d+)\s*a\s*(více|vice)/i);
  if (plus) return { ageMin: Number(plus[1]) };
  return {};
}

function categoryAudience(
  name: string,
  ageMax?: number,
): "kids" | "youth" | "mixed" {
  if (/šneček|snecek|děti|deti|\bkids\b|benjamin|předžák|predzak|žák/i.test(name)) {
    return "kids";
  }
  if (ageMax != null && ageMax <= 14) return "kids";
  if (/kadet|junior/i.test(name) || (ageMax != null && ageMax <= 18)) return "youth";
  return "mixed";
}

/** Trail cards + “Trasy” fact line (20 km / 15 km / Jesenický šneček). */
export function extractSumatorTrails(html: string): NonNullable<ParsedEvent["categories"]> {
  const $ = cheerio.load(html);
  const cats: NonNullable<ParsedEvent["categories"]> = [];
  const seen = new Set<string>();

  $(".rd-trail__head").each((_, head) => {
    const $head = $(head);
    const name = $head.find(".rd-trail__name").clone().children().remove().end().text().replace(/\s+/g, " ").trim();
    const distRaw = $head.find(".rd-trail__stats").text();
    const distanceKm = parseKm(distRaw);
    const $card = $head.closest(".rd-card");
    $card.find(".rd-trail__block").each((__, block) => {
      if (!/kategorie/i.test($(block).find(".rd-trail__block-title").text())) return;
      $(block)
        .find("li")
        .each((___, li) => {
          const label = $(li).text().replace(/\s+/g, " ").trim();
          if (!label || seen.has(label)) return;
          seen.add(label);
          const ages = parseAgeRange(label);
          cats.push({
            name: label,
            distanceKm,
            ...ages,
            audience: categoryAudience(label, ages.ageMax),
          });
        });
    });
    if (name && !seen.has(name)) {
      seen.add(name);
      cats.push({
        name,
        distanceKm,
        audience: categoryAudience(name),
      });
    }
  });

  if (!cats.length) {
    const facts = $(".rd-facts__item")
      .filter((_, el) => /trasy/i.test($(el).find(".rd-facts__key").text()))
      .first()
      .find(".rd-facts__val")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    for (const part of facts.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean)) {
      if (seen.has(part)) continue;
      seen.add(part);
      cats.push({
        name: part,
        distanceKm: parseKm(part),
        audience: categoryAudience(part),
      });
    }
  }

  return cats;
}

export function extractSumatorSeries(html: string): {
  seriesName?: string;
  seriesSlug?: string;
  cupUrl?: string;
} {
  const $ = cheerio.load(html);
  const cup = $("a[href*='/cup/']").first();
  const href = (cup.attr("href") || "").trim();
  const fromBtn = cup.text().replace(/\s+/g, " ").trim();
  const perex = $(".rd-perex, [property='og:description']")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const fromPerex = perex.match(/seriálu\s+(.+?)\s*$/i)?.[1]?.replace(/[.\s]+$/, "").trim();
  const seriesName = (fromBtn && !/^cup$/i.test(fromBtn) ? fromBtn : fromPerex) || undefined;
  const slugRaw = href.match(/\/cup\/([a-z0-9-]+)/i)?.[1]?.replace(/-20\d{2}$/i, "");
  let cupUrl: string | undefined;
  try {
    if (href) cupUrl = new URL(href, "https://sumator.cz").toString().split("?")[0];
  } catch {
    /* ignore */
  }
  return { seriesName, seriesSlug: slugRaw, cupUrl };
}

function parseCzDay(raw: string): string | null {
  const m = raw.replace(/\s+/g, " ").trim().match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** One Sumator `/race/slug` page — official Web, tratě, seriál. */
export function parseSumatorRaceDetail(url: string, html: string): ParsedEvent | null {
  const $ = cheerio.load(html);
  const name =
    $("h1.rd-hero__title, h1").first().text().replace(/\s+/g, " ").trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    "";
  if (!name || name.length < 3) return null;

  const dateRaw = $(".rd-facts__item")
    .filter((_, el) => /datum/i.test($(el).find(".rd-facts__key").text()))
    .first()
    .find(".rd-facts__val")
    .clone()
    .children()
    .remove()
    .end()
    .text();
  const startDate = parseCzDay(dateRaw);
  if (!startDate) return null;

  const place =
    $(".rd-facts__item")
      .filter((_, el) => /místo|misto/i.test($(el).find(".rd-facts__key").text()))
      .first()
      .find(".rd-facts__val")
      .text()
      .replace(/\s+/g, " ")
      .trim() || "Czechia";

  const discRaw = $(".rd-type-tag, .rd-type-dot").first().text().replace(/\s+/g, " ").trim();
  const disc = mapDisc(discRaw);
  const links = extractSumatorOfficialLinks(html);
  const series = extractSumatorSeries(html);
  const categories = extractSumatorTrails(html);
  const sourceUrl = url.split("?")[0]!;
  const websiteUrl = links.websiteUrl;
  const home = officialSiteHome(websiteUrl);
  const childUrls = [...new Set([home, series.cupUrl].filter(Boolean))] as string[];

  return {
    externalId: `sumator-${normalizeName(name)}-${startDate}`,
    name,
    startDate,
    placeText: place.slice(0, 80),
    countryHint: "CZ",
    discipline: disc ? [disc] : undefined,
    audience: categories.some((c) => c.audience === "kids") ? "mixed" : "mixed",
    categories: categories.length ? categories : undefined,
    sourceUrl,
    websiteUrl,
    registrationUrl: links.registrationUrl,
    regulationsUrl: links.regulationsUrl,
    seriesName: series.seriesName,
    seriesSlug: series.seriesSlug,
    seriesWebsite: home || undefined,
    childUrls: childUrls.length ? childUrls : undefined,
    confidence: websiteUrl ? 0.92 : 0.85,
  };
}

async function enrichOfficialWebsites(
  events: ParsedEvent[],
  opts?: { max?: number },
): Promise<ParsedEvent[]> {
  const max = opts?.max ?? 80;
  const { mapPool } = await import("@/lib/watcher/pool");
  const { fetchText } = await import("@/lib/watcher/http");

  const enrichable = events.filter((e) => /\/race\//i.test(e.sourceUrl));
  const today = new Date().toISOString().slice(0, 10);
  const ranked = [...enrichable].sort((a, b) => {
    const aNeed = a.websiteUrl ? 1 : 0;
    const bNeed = b.websiteUrl ? 1 : 0;
    if (aNeed !== bNeed) return aNeed - bNeed;
    const aFuture = a.startDate >= today ? 0 : 1;
    const bFuture = b.startDate >= today ? 0 : 1;
    if (aFuture !== bFuture) return aFuture - bFuture;
    return a.startDate.localeCompare(b.startDate);
  });
  const selected = new Set(ranked.slice(0, max).map((e) => e.sourceUrl));

  const enriched = await mapPool(events, 6, async (ev) => {
    if (!selected.has(ev.sourceUrl) || !/\/race\//i.test(ev.sourceUrl)) return ev;
    try {
      const page = await fetchText(ev.sourceUrl, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return ev;
      const detail = parseSumatorRaceDetail(ev.sourceUrl, page.text);
      const links = detail
        ? {
            websiteUrl: detail.websiteUrl,
            registrationUrl: detail.registrationUrl,
            regulationsUrl: detail.regulationsUrl,
          }
        : extractSumatorOfficialLinks(page.text);
      const home = officialSiteHome(links.websiteUrl);
      const childUrls = [
        ...new Set(
          [...(ev.childUrls ?? []), ...(detail?.childUrls ?? []), home].filter(Boolean) as string[],
        ),
      ];
      return {
        ...ev,
        websiteUrl: links.websiteUrl || ev.websiteUrl,
        registrationUrl: links.registrationUrl || ev.registrationUrl,
        regulationsUrl: links.regulationsUrl || ev.regulationsUrl,
        seriesName: detail?.seriesName || ev.seriesName,
        seriesSlug: detail?.seriesSlug || ev.seriesSlug,
        seriesWebsite: home || ev.seriesWebsite,
        categories: detail?.categories?.length ? detail.categories : ev.categories,
        childUrls: childUrls.length ? childUrls : ev.childUrls,
        confidence: links.websiteUrl ? Math.max(ev.confidence, 0.92) : ev.confidence,
      };
    } catch {
      return ev;
    }
  });
  return enriched;
}

async function fetchSumatorMonth(year: number, month: number): Promise<string> {
  const { fetchText } = await import("@/lib/watcher/http");
  const url = `https://sumator.cz/?date_from=${month}-${year}&date_to=${month}-${year}`;
  const page = await fetchText(url, { timeoutMs: 20_000 });
  return page.ok ? page.text : "";
}

/** Sumator list — homepage, month crawl, or /cup/ series page (incl. white-label hosts). */
export async function parseSumator(url: string, html: string): Promise<ParsedEvent[]> {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  })();

  try {
    const path = new URL(url).pathname.replace(/\/$/, "") || "/";
    if (/^\/race\/[^/]+$/.test(path)) {
      const one = parseSumatorRaceDetail(url, html);
      return one ? [one] : [];
    }
  } catch {
    /* fall through */
  }

  if (/\/cup\//i.test(url) || host.includes("jihoceskymtbpohar.cz")) {
    const parsed = host.includes("jihoceskymtbpohar.cz")
      ? parseSumatorHtml(url, html, yearFromUrl(url)).map((ev) => ({
          ...ev,
          seriesName: "Jihočeský MTB pohár",
          seriesSlug: "jihocesky-mtb-pohar",
          seriesWebsite: "https://www.jihoceskymtbpohar.cz/",
          confidence: Math.max(ev.confidence, 0.9),
        }))
      : parseSumatorCup(url, html);
    return enrichOfficialWebsites(parsed, { max: 40 });
  }

  const year = yearFromUrl(url);
  const events = parseSumatorHtml(url, html, year);

  if (host.includes("sumator.cz")) {
    const now = new Date();
    const startMonth = url.includes("date_from=")
      ? Number(url.match(/date_from=(\d{1,2})/)?.[1] || 3)
      : Math.max(1, now.getMonth());
    const months: number[] = [];
    for (let m = Math.min(startMonth, 3); m <= 12; m++) months.push(m);
    if (!months.includes(now.getMonth() + 1)) months.push(now.getMonth() + 1);

    for (const month of [...new Set(months)].sort((a, b) => a - b)) {
      const already = events.filter((e) =>
        e.startDate.startsWith(`${year}-${String(month).padStart(2, "0")}`),
      );
      if (already.length >= 8) continue;
      try {
        const chunk = await fetchSumatorMonth(year, month);
        if (!chunk) continue;
        events.push(
          ...parseSumatorHtml(`https://sumator.cz/?date_from=${month}-${year}`, chunk, year),
        );
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        /* ignore month failures */
      }
    }
  }

  const unique = dedupe(events).slice(0, 250);
  return enrichOfficialWebsites(unique, { max: 40 });
}

function parseSumatorCup(url: string, html: string): ParsedEvent[] {
  const year = yearFromUrl(url);
  const $ = cheerio.load(html);
  const heading =
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $("title").first().text().replace(/\s+/g, " ").trim() ||
    "Cup";
  const seriesName = heading
    .replace(/\b20\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Cup";
  const cupSlugRaw =
    url.match(/\/cup\/([a-z0-9-]+)/i)?.[1]?.replace(/-20\d{2}$/i, "") ||
    seriesName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  // Align with existing DB slugs from Hynek / older scrapes
  const cupSlug =
    (
      {
        "prima-cup": "primacup",
        primacup: "primacup",
      } as Record<string, string>
    )[cupSlugRaw] || cupSlugRaw;

  return parseSumatorHtml(url, html, year).map((ev) => ({
    ...ev,
    seriesName,
    seriesSlug: cupSlug,
    confidence: Math.max(ev.confidence, 0.9),
  }));
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
