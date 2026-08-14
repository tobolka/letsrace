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

/** Official Web / Registrace from Sumator race detail “Odkazy”. */
export function extractSumatorOfficialLinks(html: string): {
  websiteUrl?: string;
  registrationUrl?: string;
} {
  const $ = cheerio.load(html);
  let websiteUrl: string | undefined;
  let registrationUrl: string | undefined;

  $(".rd-card__title").each((_, el) => {
    if (!/odkazy/i.test($(el).text())) return;
    $(el)
      .parent()
      .find("a[href]")
      .each((__, a) => {
        const label = $(a).text().replace(/\s+/g, " ").trim();
        const href = ($(a).attr("href") || "").trim();
        if (!href.startsWith("http") || isAggregatorUrl(href)) return;
        if (/^web$/i.test(label) || /^stránka$/i.test(label) || /^homepage$/i.test(label)) {
          websiteUrl = href;
        } else if (/registr/i.test(label)) {
          registrationUrl = href;
        }
      });
  });

  if (!websiteUrl) {
    $("a.rd-btn").each((_, a) => {
      const label = $(a).text().replace(/\s+/g, " ").trim();
      const href = ($(a).attr("href") || "").trim();
      if (!/^web$/i.test(label)) return;
      if (href.startsWith("http") && !isAggregatorUrl(href)) websiteUrl = href;
    });
  }

  return { websiteUrl, registrationUrl };
}

async function enrichOfficialWebsites(
  events: ParsedEvent[],
  opts?: { max?: number },
): Promise<ParsedEvent[]> {
  const max = opts?.max ?? 40;
  const { mapPool } = await import("@/lib/watcher/pool");
  const { fetchText } = await import("@/lib/watcher/http");

  const enrichable = events.filter((e) => /\/race\//i.test(e.sourceUrl) || /\/race\//i.test(e.websiteUrl || ""));
  // Prefer upcoming races without an official site yet
  const today = new Date().toISOString().slice(0, 10);
  const ranked = [...enrichable].sort((a, b) => {
    const aFuture = a.startDate >= today ? 0 : 1;
    const bFuture = b.startDate >= today ? 0 : 1;
    if (aFuture !== bFuture) return aFuture - bFuture;
    return a.startDate.localeCompare(b.startDate);
  });
  const selected = new Set(
    ranked.slice(0, max).map((e) => e.websiteUrl || e.sourceUrl),
  );

  const enriched = await mapPool(events, 6, async (ev) => {
    const detail = ev.websiteUrl || ev.sourceUrl;
    if (!selected.has(detail) || !/\/race\//i.test(detail)) {
      return ev;
    }
    try {
      const page = await fetchText(detail, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return ev;
      const links = extractSumatorOfficialLinks(page.text);
      return {
        ...ev,
        websiteUrl: links.websiteUrl,
        registrationUrl: links.registrationUrl || ev.registrationUrl,
        confidence: links.websiteUrl ? Math.max(ev.confidence, 0.9) : ev.confidence,
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
    return enrichOfficialWebsites(parsed, { max: 24 });
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
