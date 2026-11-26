import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { inferPolishDiscipline } from "./competit-datasport";

function collapseWs(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function validIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso;
}

// ── 1. DS Ergebnisdienst (Germany, https://www.dsergebnis.de/) ──────────────

export type DsergebnisRow = {
  externalId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  place: string;
  discipline: Discipline;
  sourceUrl: string;
  websiteUrl: string | null;
  regulationsUrl: string | null;
  registrationUrl: string | null;
  resultsUrl: string | null;
  rawQuote: string;
};

const DS_SKIP_TITLE = /\b(?:termin\s+reserviert|reserviert)\b/i;
const DS_NOT_CYCLING =
  /\b(?:crosslauf|lauf\w*|run|running|trailrun\w*|triathlon|duathlon|swim\w*|tretroller|footbike|skating|walking|wandern|marathonlauf)\b/i;

const DS_CITY_STEMS: [RegExp, string][] = [
  [/\bbaiersbronn\b/i, "Baiersbronn"],
  [/\bvechta(?:er)?\b/i, "Vechta"],
  [/\bstahnsdorf\b/i, "Stahnsdorf"],
  [/\bherford(?:er)?\b/i, "Herford"],
  [/\bs[uü]dlichen?\s+weinstra[sß]e\b/i, "Südliche Weinstraße"],
  [/\b[uü]berherrn(?:er)?\b/i, "Überherrn"],
  [/\bneuss\b/i, "Neuss"],
  [/\bbuchholz\b|\btrelder\s+berg\b/i, "Buchholz"],
  [/\berzgebirg\w*\b/i, "Erzgebirge"],
  [/\bmain-spessart\b/i, "Main-Spessart"],
  [/\btrier\b/i, "Trier"],
  [/\bbremer\b|\bbremen\b/i, "Bremen"],
  [/\bnievenheim(?:er)?\b/i, "Nievenheim"],
  [/\bserrig\b/i, "Serrig"],
  [/\btroisdorf\b/i, "Troisdorf"],
  [/\bh[uü]rth\b/i, "Hürth"],
  [/\boffenbach\b/i, "Offenbach"],
  [/\bgie[sß]en\b/i, "Gießen"],
  [/\bgenthin\b/i, "Genthin"],
  [/\bcloppenburg(?:er)?\b/i, "Cloppenburg"],
  [/\bkendenich\b/i, "Kendenich"],
  [/\bneheim(?:er)?\b/i, "Neheim"],
  [/\bbonn\b/i, "Bonn"],
  [/\bkranenburg\b|\bniederrhein\b/i, "Kranenburg"],
  [/\bnideggen(?:-schmidt)?\b/i, "Nideggen-Schmidt"],
  [/\brheinzabern\b/i, "Rheinzabern"],
  [/\bbensheim\b/i, "Bensheim"],
  [/\bbad\s+salzdetfurth\b/i, "Bad Salzdetfurth"],
];

export function extractDsergebnisPlace(title: string): string {
  for (const [re, city] of DS_CITY_STEMS) {
    if (re.test(title)) return city;
  }
  const inMatch = title.match(/\bin\s+([A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+)?)\s*$/);
  if (inMatch?.[1]) return inMatch[1].trim();
  const vonMatch = title.match(/\b(?:von|der\s+stadt)\s+([A-ZÄÖÜ][a-zäöüß-]+)\b/);
  if (vonMatch?.[1]) return vonMatch[1].trim();
  return title;
}

export function inferDsergebnisDiscipline(title: string): Discipline {
  if (/gravel/i.test(title)) return "gravel";
  if (/cyclo\s*[- ]?cross|querfeldein|cross\s*cup|city\s*cross|\bcx\b|\bfinale\s+bl\b/i.test(title)) return "cx";
  if (/xco|cross\s*country/i.test(title)) return "xco";
  if (/mtb|mountainbike|xcm/i.test(title)) return "xcm";
  if (/\bezf\b|einzelzeitfahren|zeitfahren|paarzeitfahren/i.test(title)) return "tt";
  if (/kriterium|ortsschildsprint|\bnacht\b/i.test(title)) return "criterium";
  if (/bergrennen|bergpreis/i.test(title)) return "hill_climb";
  return "road";
}

export function parseDsergebnisDateLine(line: string): {
  startDate: string;
  endDate: string | null;
  title: string;
} | null {
  const clean = collapseWs(line);
  if (!clean) return null;

  // Range like "09./10.01.2027 Shimano DM..." or "09.-10.01.2027 ..."
  const range = clean.match(/^(\d{1,2})\.\s*[/–-]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*(.+)$/);
  if (range) {
    const [, d1, d2, mon, year, rest] = range;
    const startDate = `${year}-${mon!.padStart(2, "0")}-${d1!.padStart(2, "0")}`;
    const endDate = `${year}-${mon!.padStart(2, "0")}-${d2!.padStart(2, "0")}`;
    if (!validIsoDate(startDate) || !validIsoDate(endDate) || endDate < startDate) return null;
    return { startDate, endDate: endDate !== startDate ? endDate : null, title: collapseWs(rest!) };
  }

  // Single date like "15.11.2026BL Cyclo Cross..." or "03.01.2027 Finale..."
  const single = clean.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*(.+)$/);
  if (single) {
    const [, day, mon, year, rest] = single;
    const startDate = `${year}-${mon!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
    if (!validIsoDate(startDate)) return null;
    return { startDate, endDate: null, title: collapseWs(rest!) };
  }

  return null;
}

/** Parses https://www.dsergebnis.de/ calendar lines (Termine 2026 / 2027). */
export function parseDsergebnisCalendar(
  html: string,
  sourceUrl = "https://www.dsergebnis.de/",
): DsergebnisRow[] {
  const $ = load(html);
  const paragraphs = $("#content_area .j-text p").length
    ? $("#content_area .j-text p")
    : $("p");
  const rows: DsergebnisRow[] = [];
  const seen = new Set<string>();

  paragraphs.each((_, el) => {
    const text = collapseWs($(el).text());
    const parsed = parseDsergebnisDateLine(text);
    if (!parsed) return;
    const { startDate, endDate, title } = parsed;
    if (!title || DS_SKIP_TITLE.test(title) || DS_NOT_CYCLING.test(title)) return;

    const slug = slugify(title) || "event";
    const key = `${startDate}:${slug}`;
    if (seen.has(key)) return;
    seen.add(key);

    rows.push({
      externalId: `dsergebnis:${startDate}:${slug}`,
      title,
      startDate,
      endDate,
      place: extractDsergebnisPlace(title),
      discipline: inferDsergebnisDiscipline(title),
      sourceUrl,
      websiteUrl: null,
      regulationsUrl: null,
      registrationUrl: null,
      resultsUrl: null,
      rawQuote: text.slice(0, 280),
    });
  });

  return rows;
}

export function extractDsergebnisSubpages(
  html: string,
  baseUrl = "https://www.dsergebnis.de/",
): string[] {
  const $ = load(html);
  const out = new Set<string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href")?.trim() ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (!/dsergebnis\.de$/i.test(url.hostname)) return;
    const path = url.pathname;
    if (
      path === "/" ||
      path.startsWith("/archiv/") ||
      path.startsWith("/meldelisten") ||
      path.startsWith("/ergebnisse") ||
      path.startsWith("/bilder") ||
      path.startsWith("/dienstleistungen") ||
      path.startsWith("/referenzen") ||
      path.startsWith("/ausschreibungen-rad-net") ||
      path.startsWith("/j/") ||
      path.startsWith("/app/")
    ) {
      return;
    }
    out.add(url.toString());
  });
  return [...out];
}

export type DsergebnisSubpageInfo = {
  dates: string[];
  place: string | null;
  websiteUrl: string | null;
  regulationsUrl: string | null;
  registrationUrl: string | null;
  resultsUrl: string | null;
  text: string;
};

const DS_AGGREGATOR_HOSTS =
  /dsergebnis\.de|rad-net\.de|sporthive\.com|mylaps\.com|race-hub\.io|1drv\.ms|onedrive\.live\.com|powr\.io|facebook\.com|instagram\.com|komoot\.com|datasport\.de|zpn-timing\.de|heuer-radsport\.de|jimdo\.com|jimstatic\.com|google\./i;

export function extractDsergebnisSubpageInfo(html: string, pageUrl: string): DsergebnisSubpageInfo {
  const $ = load(html);
  const area = $("#content_area").length ? $("#content_area") : $("body");
  area.find("script,style").remove();
  const text = collapseWs(area.text());
  const dates = [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g)].map(
    (m) => `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`,
  );

  let websiteUrl: string | null = null;
  let regulationsUrl: string | null = null;
  let registrationUrl: string | null = null;
  let resultsUrl: string | null = null;

  area.find("a[href]").each((_, a) => {
    const href = $(a).attr("href")?.trim() ?? "";
    const label = collapseWs($(a).text());
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    let abs: string;
    try {
      abs = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:\/\//i.test(abs)) return;

    if (/rad-net\.de.*ausschreibung|generalausschreibung|reglement|teilnahmeinformation/i.test(`${abs} ${label}`)) {
      if (!regulationsUrl) regulationsUrl = abs;
    } else if (/race-hub\.io|anmeldung/i.test(`${abs} ${label}`)) {
      if (!registrationUrl) registrationUrl = abs;
    } else if (/sporthive\.com|mylaps\.com|ergebnis/i.test(`${abs} ${label}`)) {
      if (!resultsUrl) resultsUrl = abs;
    } else if (!DS_AGGREGATOR_HOSTS.test(abs) && !/\.pdf(\?|$)/i.test(abs)) {
      if (!websiteUrl) websiteUrl = abs;
    }
  });

  const placeCandidate = extractDsergebnisPlace(`${pageUrl} ${text.slice(0, 400)}`);
  const place = placeCandidate && placeCandidate.length <= 40 ? placeCandidate : null;
  return { dates: [...new Set(dates)], place, websiteUrl, regulationsUrl, registrationUrl, resultsUrl, text };
}

export function dsergebnisParsedEvent(row: DsergebnisRow): ParsedEvent {
  return {
    externalId: row.externalId,
    name: row.title,
    startDate: row.startDate,
    ...(row.endDate ? { endDate: row.endDate } : {}),
    placeText: row.place,
    countryHint: "DE",
    discipline: [row.discipline],
    sourceUrl: row.sourceUrl,
    ...(row.websiteUrl ? { websiteUrl: row.websiteUrl } : {}),
    ...(row.regulationsUrl ? { regulationsUrl: row.regulationsUrl } : {}),
    ...(row.registrationUrl ? { registrationUrl: row.registrationUrl } : {}),
    ...(row.resultsUrl ? { resultsUrl: row.resultsUrl } : {}),
    confidence: 0.85,
    evidence: {
      quote: row.rawQuote,
      sourceUrl: row.sourceUrl,
      method: "dsergebnis_de",
      version: "dsergebnis-v1",
    },
  };
}

// ── 2. B4SportOnline (Poland, https://b4sportonline.pl/) ────────────────────

export type B4SportCard = {
  id: string;
  title: string;
  startDate: string;
  dateLabel: string;
  place: string;
  organizer: string;
  detailPath: string | null;
  registrationPath: string | null;
  subTitles: string[];
  isClearlyCycling: boolean;
  isClearlyNonCycling: boolean;
  rawQuote: string;
};

export type B4SportDetailInfo = {
  isCycling: boolean;
  isNonCycling: boolean;
  discipline: Discipline;
  websiteUrl: string | null;
  regulationsUrl: string | null;
};

const B4_CYCLING_RE =
  /\b(?:rower\w*|mtb|kolar\w*|bike\w*|bikepacking\w*|gravel\w*|szos\w*|velo\w*|ultravelo\w*|cyklo\w*|prze[lł]aj\w*|xco|xcm|enduro|bmx|szutr\w*)\b/i;

const B4_NOT_CYCLING_RE =
  /\b(?:bieg\w*|p[oó][lł]maraton\w*|maraton\s+pieszy|rajd\s+pieszy|nordic\s+walking|marsz\w*|triathlon\w*|duathlon\w*|aquathlon\w*|p[lł]ywac\w*|swim\w*|trail\s*run\w*|ultra[- ]?trail\w*|ninja|akrobatyk\w*|4x4|pi[lł]k\w*|3v3|turniej|sup\s+race|wolontariat|ch[oó]d)\b/i;

const PL_LOWER_WORDS = new Set(["nad", "pod", "k.", "koło", "kolo", "w", "we", "z", "ze", "na", "i", "u", "o"]);

export function formatPolishPlace(raw: string): string {
  const clean = collapseWs(raw);
  if (!clean) return "";
  if (clean !== clean.toUpperCase()) return clean;
  return clean
    .toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (idx > 0 && PL_LOWER_WORDS.has(word)) return word;
      return word
        .split("-")
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join("-");
    })
    .join(" ");
}

export function b4SportSearchDateUrl(date: string): string {
  return `https://b4sportonline.pl/kalendarz/searching/od/${date}/do/${date}?lang=pl`;
}

export function b4SportWindowUrl(fromDate: string, toDate: string): string {
  return `https://b4sportonline.pl/kalendarz/searching/od/${fromDate}/do/${toDate}?lang=pl`;
}

export function inferB4SportDiscipline(haystack: string): Discipline {
  if (/gravel|szutr|bikepacking|divide/i.test(haystack)) return "gravel";
  if (/szos|road\b|klasyk|kryterium|czas[oó]wk/i.test(haystack)) return "road";
  return inferPolishDiscipline(haystack);
}

/** Parses `.single-search-result-container` cards from b4sportonline.pl/kalendarz/searching/... */
export function parseB4SportSearchCards(html: string): B4SportCard[] {
  const $ = load(html);
  const cards: B4SportCard[] = [];
  const seen = new Set<string>();

  $(".single-search-result-container").each((_, el) => {
    const startDate = ($(el).attr("data-start-date") ?? "").trim();
    if (!validIsoDate(startDate)) return;

    const title = collapseWs($(el).find("h5").first().text());
    if (!title) return;

    const organizer = collapseWs($(el).find("a[href*='/organizator/']").first().text());
    const rawPlace = collapseWs($(el).find("a[href*='/miasto/']").first().text());
    const place = formatPolishPlace(rawPlace) || "Polska";

    const gcal = $(el).find("a.google-calendar").first();
    const dateLabel = collapseWs(gcal.text());
    if (!dateLabel) return;

    let detailPath = null as string | null;
    $(el)
      .find("a[href]")
      .each((__, a) => {
        const txt = collapseWs($(a).text());
        const href = $(a).attr("href")?.trim() ?? "";
        if (/Strona www/i.test(txt) && href.startsWith("/") && !detailPath) {
          detailPath = href;
        }
      });

    const subTitles: string[] = [];
    let registrationPath = null as string | null;
    $(el)
      .find(".card-hidden-events-list li")
      .each((__, li) => {
        const a = $(li).find("a[href]").first();
        const href = a.attr("href")?.trim() ?? "";
        if (href.startsWith("/") && !registrationPath) registrationPath = href;
        const clone = $(li).clone();
        clone.find("a").remove();
        const subTitle = collapseWs(clone.text());
        if (subTitle) subTitles.push(subTitle);
      });

    if (!registrationPath) {
      $(el)
        .find("a[href]")
        .each((__, a) => {
          const txt = collapseWs($(a).text());
          const href = $(a).attr("href")?.trim() ?? "";
          if (/Dołącz do wydarzenia/i.test(txt) && href.startsWith("/") && !registrationPath) {
            registrationPath = href;
          }
        });
    }

    const numericId = registrationPath?.match(/\/(\d+)(?:[/?#]|$)/)?.[1];
    const slugId = detailPath?.replace(/^\/+|\/+$/g, "") || slugify(title);
    const id = numericId ? `${numericId}` : `${slugId}:${startDate}`;
    if (seen.has(id)) return;
    seen.add(id);

    // Check title + sub-events only (never organizer name, e.g. "Bieg Sylwestrowy" by "Rowerowa Brzoza")
    const eventHay = `${title} ${subTitles.join(" ")}`;
    const isClearlyNonCycling = B4_NOT_CYCLING_RE.test(eventHay) && !B4_CYCLING_RE.test(eventHay);
    const isClearlyCycling = B4_CYCLING_RE.test(eventHay) && !B4_NOT_CYCLING_RE.test(eventHay);

    cards.push({
      id,
      title,
      startDate,
      dateLabel,
      place,
      organizer,
      detailPath,
      registrationPath,
      subTitles,
      isClearlyCycling,
      isClearlyNonCycling,
      rawQuote: `${title}\n${dateLabel}`.slice(0, 280),
    });
  });

  return cards;
}

/** Inspects a b4sportonline.pl event/organizer page for cycling confirmation and official links. */
export function inspectB4SportDetail(html: string, detailUrl: string, cardTitle = ""): B4SportDetailInfo {
  const $ = load(html);
  $("script,style,noscript").remove();
  const bodyText = collapseWs($("body").text());

  const hasCycling = B4_CYCLING_RE.test(bodyText);
  const hasRunningOnly =
    /\b(?:czyli\s+bieg|bieg\s+po\s+g[oó]wn|bieg\s+g[oó]rski|biegi\s+uliczne|nordic\s+walking|zawody\s+p[lł]ywack|4x4|ninja|pi[lł]k\w*\s+no[zż]n)\b/i.test(
      bodyText,
    ) ||
    (!hasCycling && B4_NOT_CYCLING_RE.test(bodyText));

  const titleWords = (cardTitle.toLowerCase().match(/[a-ząćęłńóśźż0-9]{4,}/g) ?? []).filter(
    (w) => !["2026", "2027", "race", "bike", "challenge", "ultra", "maraton"].includes(w),
  );

  const candidates: { href: string; isReg: boolean; score: number }[] = [];
  $("a[href^='http']").each((_, a) => {
    const href = $(a).attr("href")?.trim() ?? "";
    if (!href || /b4sportonline\.pl|facebook\.com|twitter\.com|instagram\.com|google\.|youtu\.be|youtube\.com/i.test(href)) {
      return;
    }
    const label = collapseWs($(a).text());
    const context = collapseWs(`${$(a).parent().text()} ${label} ${href}`).toLowerCase();
    const isReg = /regulamin/i.test(`${label} ${href}`);
    let score = 0;
    for (const w of titleWords) {
      if (context.includes(w)) score += 3;
      if (href.toLowerCase().includes(w)) score += 5;
    }
    candidates.push({ href, isReg, score });
  });

  candidates.sort((a, b) => b.score - a.score);
  const websiteUrl = candidates.find((c) => !c.isReg)?.href ?? null;
  const regulationsUrl = candidates.find((c) => c.isReg)?.href ?? null;
  const linkHay = candidates.map((c) => c.href).join(" ");

  return {
    isCycling: (hasCycling || /\b(?:velo|bike|mtb|gravel|kolar)\b/i.test(linkHay)) && !hasRunningOnly,
    isNonCycling: hasRunningOnly,
    discipline: inferB4SportDiscipline(`${cardTitle} ${bodyText}`),
    websiteUrl,
    regulationsUrl,
  };
}

export function b4SportParsedEvent(
  card: B4SportCard,
  opts: {
    sourceUrl: string;
    discipline: Discipline;
    websiteUrl?: string | null;
    regulationsUrl?: string | null;
    registrationUrl?: string | null;
    quote?: string;
  },
): ParsedEvent {
  return {
    externalId: `b4sport:${card.id}`,
    name: card.title,
    startDate: card.startDate,
    placeText: card.place,
    countryHint: "PL",
    discipline: [opts.discipline],
    sourceUrl: opts.sourceUrl,
    ...(opts.websiteUrl ? { websiteUrl: opts.websiteUrl } : {}),
    ...(opts.regulationsUrl ? { regulationsUrl: opts.regulationsUrl } : {}),
    ...(opts.registrationUrl ? { registrationUrl: opts.registrationUrl } : {}),
    confidence: 0.85,
    evidence: {
      quote: (opts.quote ?? card.rawQuote).slice(0, 280),
      sourceUrl: opts.sourceUrl,
      method: "b4sportonline_pl",
      version: "b4sport-v1",
    },
  };
}
