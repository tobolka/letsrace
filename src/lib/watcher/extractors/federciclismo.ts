import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const IT_MONTHS: Record<string, string> = {
  gennaio: "01",
  febbraio: "02",
  marzo: "03",
  aprile: "04",
  maggio: "05",
  giugno: "06",
  luglio: "07",
  agosto: "08",
  settembre: "09",
  ottobre: "10",
  novembre: "11",
  dicembre: "12",
};

function parseItalianDate(raw: string): string | null {
  const m = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})\s+([A-Za-zàèéìòù]+)\s+(\d{4})/i);
  if (!m) return null;
  const mon = IT_MONTHS[m[2]!.toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1]!.padStart(2, "0")}`;
}

function mapFciDiscipline(text: string): Discipline[] {
  const t = text.toLowerCase();
  if (/fuoristrada|mtb|mountain/.test(t)) return ["xco"];
  if (/pista|track/.test(t)) return ["other"];
  if (/ciclocross|cyclo/.test(t)) return ["cx"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/strada|road|gran.?premio|amatoriale/.test(t)) return ["road"];
  return ["road"];
}

function parseFciPage(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const origin = new URL(url).origin;

  $("ul.GareList > li").each((_, el) => {
    const $li = $(el);
    const a = $li.find('a[href*="/race/detail/"]').first();
    const href = a.attr("href");
    if (!href) return;

    const id = href.match(/\/race\/detail\/(\d+)/)?.[1];
    const dateRaw = a.find(".calData").text().replace(/\s+/g, " ").trim();
    const startDate = parseItalianDate(dateRaw);
    if (!startDate) return;

    const name =
      a.find("h3").text().replace(/\s+/g, " ").trim() ||
      a.text().replace(/\s+/g, " ").trim().slice(0, 120);
    if (!name || name.length < 3) return;

    const spans = a
      .find("span")
      .not(".calData")
      .map((__, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    const placeText = spans[0] || "Italia";
    const tipo = spans[1] || a.find("h4").text();
    const abs = href.startsWith("http") ? href : `${origin}${href}`;

    events.push({
      externalId: `fci-${id || normalizeName(name)}-${startDate}`,
      name: name.replace(/^Pista\s*-\s*/i, "").replace(/^Strada\s*-\s*/i, "").trim(),
      startDate,
      placeText: placeText.slice(0, 100),
      countryHint: "IT",
      discipline: mapFciDiscipline(`${name} ${tipo}`),
      audience: /giovanile|junior|esordienti|allieve|allievi|ragazzi/i.test(`${name} ${tipo}`)
        ? "youth"
        : "mixed",
      sourceUrl: abs.replace(/\/$/, ""),
      confidence: 0.82,
    });
  });

  return events;
}

async function fetchFciPage(pageUrl: string): Promise<string> {
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent": "StartlineBot/0.1 (+https://startline.app; race calendar aggregator)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return "";
  return res.text();
}

/** Italian FCI race calendar — paginated HTML list. */
export async function parseFederciclismo(url: string, html: string): Promise<ParsedEvent[]> {
  const byKey = new Map<string, ParsedEvent>();
  for (const ev of parseFciPage(url, html)) {
    byKey.set(ev.externalId, ev);
  }

  const $ = cheerio.load(html);
  const pageLinks = new Set<string>();
  $("ul.pagination a[href*='page=']").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const abs = href.startsWith("http")
      ? href
      : `https://members.federciclismo.it${href.startsWith("/") ? "" : "/"}${href}`;
    pageLinks.add(abs);
  });

  // Crawl a handful of further pages (site defaults to ~1 month window)
  const pages = [...pageLinks]
    .sort((a, b) => {
      const pa = Number(new URL(a).searchParams.get("page") || 0);
      const pb = Number(new URL(b).searchParams.get("page") || 0);
      return pa - pb;
    })
    .slice(0, 8);

  for (const pageUrl of pages) {
    const pageNum = Number(new URL(pageUrl).searchParams.get("page") || 0);
    if (pageNum <= 1) continue;
    const pageHtml = await fetchFciPage(pageUrl);
    if (!pageHtml) continue;
    for (const ev of parseFciPage(pageUrl, pageHtml)) {
      byKey.set(ev.externalId, ev);
    }
  }

  return [...byKey.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}
