import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";

const CZ_MONTHS: Record<string, string> = {
  leden: "01", ledna: "01",
  unor: "02", unora: "02",
  brezen: "03", brezna: "03",
  duben: "04", dubna: "04",
  kveten: "05", kvetna: "05",
  cerven: "06", cervena: "06", cervna: "06",
  cervenec: "07", cervence: "07",
  srpen: "08", srpna: "08",
  zari: "09",
  rijen: "10", rijna: "10",
  listopad: "11", listopadu: "11",
  prosinec: "12", prosince: "12",
};

export function foldCzech(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function validIsoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Parses Czech numeric (`26.4.2026`, `26. 4. 2026`) or word (`26. dubna 2026`) dates to YYYY-MM-DD. */
export function parseCzechDate(raw: string, fallbackYear?: number): string | null {
  const clean = foldCzech(raw).replace(/\s+/g, " ").trim();
  const numFull = clean.match(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\b/);
  if (numFull) {
    return validIsoDate(Number(numFull[3]), Number(numFull[2]), Number(numFull[1]));
  }
  const wordFull = clean.match(/\b(\d{1,2})\.\s*([a-z]+)\s+(20\d{2})\b/);
  if (wordFull) {
    const mon = CZ_MONTHS[wordFull[2]!];
    if (mon) return validIsoDate(Number(wordFull[3]), Number(mon), Number(wordFull[1]));
  }
  if (fallbackYear) {
    const numShort = clean.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?!\d)/);
    if (numShort) {
      return validIsoDate(fallbackYear, Number(numShort[2]), Number(numShort[1]));
    }
    const wordShort = clean.match(/\b(\d{1,2})\.\s*([a-z]+)\b/);
    if (wordShort) {
      const mon = CZ_MONTHS[wordShort[2]!];
      if (mon) return validIsoDate(fallbackYear, Number(mon), Number(wordShort[1]));
    }
  }
  return null;
}

const CZ_TEST_DUMMY = /(?:^__?test|testov[aá]n[ií]|workshop\s+test|\btest\b.*\b(?:propojen|smazat)\b)/i;

const CZ_NON_CYCLING =
  /\b(?:beh\w*|bezeck\w*|pulmaraton|halfmarathon|run\b|running|trailrun|triatlon\w*|triathlon\w*|duatlon\w*|duathlon\w*|kvadriatlon\w*|quadrathlon\w*|aquatlon\w*|aquathlon\w*|plavan\w*|swim\w*|lyzovan\w*|lyze\b|skialp\w*|ski\b|bezky|canicross\w*|kolobeh\w*|kolobezk\w*|footbike|chodeck\w*|chuze|racewalking|inline|bruslen\w*|longboard|skateboard|autocross|motosport|motorsport|ocr\b|prekazkov\w*|ples\b|galavecer|vyhlaseni|vyjizdk\w*|aktualit\w*|schuze|trilogie|nordic|stafet\w*\s+maraton|kondicni\s+test|kajak\w*|canoe)\b/;

const CZ_CYCLING_CUE =
  /\b(?:cykl\w*|mtb|xco|xcc|xce|xcm|mtbo|gravel|cyklokros|cyclocross|enduro|downhill|pumptrack|bmx|bikemaraton|bike\s*maraton|horsk\w*\s+kol\w*|silnicni\w*\s+(?:zavod|casovk|kriterium|prolog)|casovk\w*|kriterium|do\s+vrchu|velodrom|four\s*cross)\b/;

export function isCzechCyclingRace(text: string, opts?: { trustedCyclingSource?: boolean }): boolean {
  if (!text.trim()) return false;
  if (CZ_TEST_DUMMY.test(text)) return false;
  const folded = foldCzech(text);
  if (CZ_NON_CYCLING.test(folded)) return false;
  if (/\bkros\b/.test(folded) && !CZ_CYCLING_CUE.test(folded)) return false;
  if (/\bcross\s*country\b/.test(folded) && !opts?.trustedCyclingSource && !CZ_CYCLING_CUE.test(folded)) return false;
  if (opts?.trustedCyclingSource) return true;
  return CZ_CYCLING_CUE.test(folded);
}

export function inferCzechDiscipline(text: string): Discipline {
  const f = foldCzech(text);
  if (/\b(?:cyklokros|cyclocross|cx)\b/.test(f)) return "cx";
  if (/\bgravel\b/.test(f)) return "gravel";
  if (/\benduro\b/.test(f)) return "enduro";
  if (/\b(?:downhill|dh|sjezd)\b/.test(f)) return "dh";
  if (/\b(?:bmx|pumptrack)\b/.test(f)) return "bmx";
  if (/\bmtbo\b/.test(f)) return "mtbo";
  if (/\b(?:xcc|short\s*track)\b/.test(f)) return "xcc";
  if (/\b(?:xce|eliminator)\b/.test(f)) return "xce";
  if (/\b(?:xco|cross\s*country)\b/.test(f)) return "xco";
  if (/\b(?:xcm|cyklomaraton|bikemaraton|bike\s*maraton|mtb\s*maraton)\b/.test(f)) return "xcm";
  if (/\b(?:mtb|horsk\w*\s+kol\w*|terenni)\b/.test(f)) return "mtb";
  if (/\b(?:casovk\w*|prolog|time\s*trial)\b/.test(f)) return "tt";
  if (/\b(?:kriterium|criterium)\b/.test(f)) return "criterium";
  if (/\b(?:do\s+vrchu|vrchozdol|hill\s*climb)\b/.test(f)) return "hill_climb";
  if (/\b(?:silnic\w*|road)\b/.test(f)) return "road";
  return "mtb";
}

export function detectCzOrSk(text: string): "CZ" | "SK" {
  const f = foldCzech(text);
  if (/\b(?:slovensk\w*|slovakia|bratislav\w*|kosic\w*|zilin\w*|trnav\w*|nitr\w*|trencin\w*|poprad\w*|presov\w*|banska\s+bystric\w*|piestan\w*|svk)\b/.test(f)) {
    return "SK";
  }
  return "CZ";
}

function cleanText(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(raw: string): string {
  return cleanText(load(`<span>${raw}</span>`).text());
}

// ── 1. Cykloman.cz ──────────────────────────────────────────────────────────

export type CyklomanListRow = {
  id: string;
  title: string;
  startDate: string;
  url: string;
  typeLabel: string;
  isKids: boolean;
  discipline: Discipline;
  rawQuote: string;
};

export type CyklomanDetail = {
  url: string;
  title: string;
  startDate: string | null;
  placeText: string | null;
  disciplineText: string | null;
  websiteUrl: string | null;
  registrationUrl: string | null;
  regulationsUrl: string | null;
  resultsUrl: string | null;
  rawQuote: string;
};

export function parseCyklomanList(
  html: string,
  sourceUrl = "https://www.cykloman.cz/zavody-a-akce/seznam",
  fallbackYear?: number,
): CyklomanListRow[] {
  const $ = load(html);
  const heading = cleanText($("main h2, .cal-head h2").first().text());
  const yearMatch = heading.match(/\b(20\d{2})\b/)?.[1] ?? sourceUrl.match(/\/(20\d{2})(?:\/|$)/)?.[1];
  const year = yearMatch ? Number(yearMatch) : fallbackYear;
  if (!year) return [];

  const rows: CyklomanListRow[] = [];
  const seen = new Set<string>();

  $("section.cal-month-group").each((_, sec) => {
    const monthMatch = $(sec).attr("id")?.match(/^mesic-(\d{1,2})$/);
    if (!monthMatch) return;
    const month = Number(monthMatch[1]);

    $(sec).find("article.cal-card").each((__, card) => {
      const el = $(card);
      if (el.hasClass("cal-k-news") || el.hasClass("cal-k-ride")) return;
      const isKids = el.hasClass("cal-k-kids");
      const typeLabel = cleanText(el.find(".cal-card-type").first().text());
      const dayNum = Number(cleanText(el.find(".cal-card-date strong").first().text()).replace(/\D+/g, ""));
      const a = el.find("h4 a").first();
      const title = cleanText(a.text());
      const href = a.attr("href")?.trim() ?? "";
      if (!dayNum || !title || !href) return;

      const startDate = validIsoDate(year, month, dayNum);
      if (!startDate) return;

      const trusted = el.hasClass("cal-k-race") || el.hasClass("cal-k-outside") || isKids;
      if (!isCzechCyclingRace(`${title} ${typeLabel}`, { trustedCyclingSource: trusted })) return;

      const url = new URL(href, "https://www.cykloman.cz/").toString();
      const id = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
      if (!id || seen.has(id)) return;
      seen.add(id);

      rows.push({
        id,
        title,
        startDate,
        url,
        typeLabel,
        isKids,
        discipline: inferCzechDiscipline(`${title} ${typeLabel}`),
        rawQuote: cleanText(`${dayNum}.${month}.${year} ${typeLabel} ${title}`).slice(0, 260),
      });
    });
  });

  return rows;
}

function cleanCyklomanPlace(raw: string): string | null {
  const cleaned = cleanText(raw)
    .replace(/\bv\s+\d{1,2}:\d{2}\b.*$/i, "")
    .replace(/\bod\s+\d{1,2}(?::\d{2})?\s*hodin\b.*$/i, "")
    .replace(/\s*[–-]\s*Sraz\b.*$/i, "")
    .replace(/\s*-\s*bývalá\b.*$/i, "")
    .replace(/,\s*$/, "")
    .trim();
  if (!cleaned || /bude\s+up[rř]esn[eě]no/i.test(cleaned)) return null;
  const firstSegment = cleaned.split(/\s+[–-]\s+/)[0]?.trim() ?? cleaned;
  return firstSegment.slice(0, 120) || null;
}

export function parseCyklomanDetail(html: string, url: string): CyklomanDetail {
  const $ = load(html);
  const title = cleanText($("main h2").first().text());
  const fields = new Map<string, { text: string; html: string }>();

  $("table.general tr").each((_, tr) => {
    const th = foldCzech(cleanText($(tr).find("th").first().text()));
    const td = $(tr).find("td").first();
    if (!th || !td.length) return;
    fields.set(th, { text: cleanText(td.text()), html: td.html() ?? "" });
  });

  const termText = fields.get("termin konani")?.text ?? "";
  const startDate = termText ? parseCzechDate(termText) : null;
  const startPlaceRaw = fields.get("misto a cas startu")?.text ?? fields.get("misto")?.text ?? "";
  const placeText = startPlaceRaw ? cleanCyklomanPlace(startPlaceRaw) : null;
  const disciplineText = fields.get("druh akce")?.text ?? null;

  let registrationUrl: string | null = null;
  let regulationsUrl: string | null = $("span#propozice").length ? url : null;
  let resultsUrl: string | null = null;
  let websiteUrl: string | null = null;

  $("#nav-local a").each((_, a) => {
    const href = $(a).attr("href")?.trim();
    const label = foldCzech(cleanText($(a).text()));
    if (!href || href.startsWith("#")) return;
    const abs = new URL(href, url).toString();
    if (href.includes("/vysledky") || label.includes("vysledky")) resultsUrl ??= abs;
    if (href.includes("/prihlaseni") || label.includes("prihlasen")) registrationUrl ??= abs;
  });

  $("table.general a[href^='http']").each((_, a) => {
    const href = $(a).attr("href")?.trim();
    if (!href) return;
    const text = foldCzech(cleanText($(a).text()));
    if (/sportengo\.cz\/zavody\//i.test(href)) registrationUrl = href;
    if (/propozic/i.test(text) && !regulationsUrl) regulationsUrl = href;
    if (/vysledk/i.test(text) && !resultsUrl) resultsUrl = href;
    if (!/cykloman\.cz|mapy\.(?:cz|com)|sportengo\.cz|trepp-art/i.test(href) && /web|strank|poradatel/i.test(text) && !websiteUrl) {
      websiteUrl = href;
    }
  });

  const quoteParts = [title, termText, startPlaceRaw, disciplineText].filter(Boolean);
  const rawQuote = cleanText(quoteParts.join(" | ")).slice(0, 260);

  return {
    url,
    title,
    startDate,
    placeText,
    disciplineText,
    websiteUrl,
    registrationUrl,
    regulationsUrl,
    resultsUrl,
    rawQuote,
  };
}

export function cyklomanParsedEvent(row: CyklomanListRow, detail?: CyklomanDetail | null): ParsedEvent {
  const name = (detail?.title || row.title).slice(0, 160);
  const startDate = detail?.startDate ?? row.startDate;
  const placeText = detail?.placeText || "Moravská Třebová";
  const disc = inferCzechDiscipline(`${name} ${row.typeLabel} ${detail?.disciplineText ?? ""}`);
  const sourceUrl = detail?.url ?? row.url;

  return {
    externalId: `cykloman:${row.id}`,
    name,
    startDate,
    placeText,
    countryHint: "CZ",
    discipline: [disc],
    ...(row.isKids ? { audience: "kids" as const } : {}),
    sourceUrl,
    websiteUrl: detail?.websiteUrl ?? row.url,
    ...(detail?.registrationUrl ? { registrationUrl: detail.registrationUrl } : {}),
    ...(detail?.regulationsUrl ? { regulationsUrl: detail.regulationsUrl } : {}),
    ...(detail?.resultsUrl ? { resultsUrl: detail.resultsUrl } : {}),
    confidence: detail ? 0.9 : 0.8,
    evidence: {
      quote: (detail?.rawQuote || row.rawQuote).slice(0, 260),
      sourceUrl,
      method: "cykloman_cz",
      version: "cykloman-v1",
    },
  };
}

// ── 2. Irontime.cz ──────────────────────────────────────────────────────────

export type IrontimeApiRace = {
  id: number;
  name?: string | null;
  name_en?: string | null;
  short_name?: string | null;
  race_type?: number | null;
  race_type_label?: { cs?: string | null; en?: string | null } | null;
  location?: string | null;
  venue?: string | null;
  distance?: number | null;
  date_start?: string | null;
  date_end?: string | null;
  status?: string | null;
  results_public?: boolean | null;
  registration_status?: string | null;
  external_registration_url?: string | null;
  international?: boolean | null;
  gps?: string | null;
  gps2?: string | null;
};

const IRONTIME_CYCLING_TYPES = new Set([4, 8]); // 4=MTB, 8=silniční cyklistika
const IRONTIME_NON_CYCLING_TYPES = new Set([1, 2, 3, 5, 11, 13, 14, 18, 27, 29, 30]);

export type IrontimeRow = {
  id: number;
  name: string;
  startDate: string;
  endDate?: string;
  placeText: string;
  countryHint: "CZ" | "SK";
  discipline: Discipline;
  sourceUrl: string;
  registrationUrl?: string;
  resultsUrl?: string;
  lat?: number;
  lng?: number;
  rawQuote: string;
};

function parseLatLng(raw: string | null | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function isIrontimeCyclingRace(race: IrontimeApiRace): boolean {
  const name = cleanText(race.name ?? "");
  if (!name || name.length < 3) return false;
  if (!race.date_start || !/^(20\d{2})-(\d{2})-(\d{2})$/.test(race.date_start)) return false;
  if (CZ_TEST_DUMMY.test(name)) return false;

  const rt = race.race_type ?? 0;
  if (IRONTIME_NON_CYCLING_TYPES.has(rt)) return false;

  const label = `${race.race_type_label?.cs ?? ""} ${race.race_type_label?.en ?? ""}`;
  if (CZ_NON_CYCLING.test(foldCzech(name))) return false;

  if (IRONTIME_CYCLING_TYPES.has(rt)) return true;
  if (rt === 26 || rt === 28) {
    // 26=cyklojízda (recreational ride), 28=Offroad (usually moto/quad): take only if explicitly a bike race.
    return isCzechCyclingRace(name, { trustedCyclingSource: false }) && !/\bcykloj[ií]zd/i.test(name);
  }
  return isCzechCyclingRace(`${name} ${label}`, { trustedCyclingSource: false });
}

export function parseIrontimeRaces(records: IrontimeApiRace[]): IrontimeRow[] {
  const rows: IrontimeRow[] = [];
  const seen = new Set<number>();

  for (const race of records) {
    if (!race.id || seen.has(race.id)) continue;
    if (!isIrontimeCyclingRace(race)) continue;

    const name = cleanText(race.name ?? "");
    const startDate = race.date_start!;
    const endRaw = race.date_end?.slice(0, 10);
    const endDate = endRaw && /^20\d{2}-\d{2}-\d{2}$/.test(endRaw) && endRaw !== startDate ? endRaw : undefined;
    const placeText = cleanText(race.location || race.venue || "");
    if (!placeText) continue;

    seen.add(race.id);
    const label = race.race_type_label?.cs ?? "";
    const disc = inferCzechDiscipline(`${name} ${label}`);
    const sourceUrl = `https://irontime.cz/vysledky${race.id}/`;
    const extReg = race.external_registration_url?.trim();
    const registrationUrl =
      extReg && /^https?:\/\//i.test(extReg)
        ? extReg
        : race.registration_status === "open"
          ? `https://irontime.cz/prihlaska${race.id}/`
          : undefined;
    const resultsUrl = race.results_public || race.status === "finished" ? sourceUrl : undefined;
    const coords = parseLatLng(race.gps) ?? parseLatLng(race.gps2);
    const countryHint = detectCzOrSk(`${name} ${placeText} ${race.venue ?? ""}`);

    rows.push({
      id: race.id,
      name,
      startDate,
      ...(endDate ? { endDate } : {}),
      placeText,
      countryHint,
      discipline: disc,
      sourceUrl,
      ...(registrationUrl ? { registrationUrl } : {}),
      ...(resultsUrl ? { resultsUrl } : {}),
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      rawQuote: cleanText(`${name} | ${startDate} | ${placeText}${label ? ` | ${label}` : ""}`).slice(0, 260),
    });
  }

  return rows;
}

export function irontimeParsedEvent(row: IrontimeRow): ParsedEvent {
  return {
    externalId: `irontime:${row.id}`,
    name: row.name.slice(0, 160),
    startDate: row.startDate,
    ...(row.endDate ? { endDate: row.endDate } : {}),
    placeText: row.placeText,
    countryHint: row.countryHint,
    discipline: [row.discipline],
    sourceUrl: row.sourceUrl,
    ...(row.registrationUrl ? { registrationUrl: row.registrationUrl } : {}),
    ...(row.resultsUrl ? { resultsUrl: row.resultsUrl } : {}),
    ...(row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : {}),
    confidence: 0.85,
    evidence: {
      quote: row.rawQuote,
      sourceUrl: row.sourceUrl,
      method: "irontime_cz",
      version: "irontime-v1",
    },
  };
}

// ── 3. Sportovniservis.cz ───────────────────────────────────────────────────

export type SportovniServisWpPost = {
  id: number;
  date?: string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  categories?: number[];
  tags?: number[];
};

const SS_CYCLING_TAGS = new Set([9, 188, 233]); // Cycling, mtb, BMX
const SS_CYCLING_CATS = new Set([69]); // Propozice > Cyklistika

export type SportovniServisRow = {
  id: string;
  title: string;
  startDate: string;
  placeText: string;
  countryHint: "CZ" | "SK";
  discipline: Discipline;
  sourceUrl: string;
  websiteUrl?: string;
  registrationUrl?: string;
  resultsUrl?: string;
  rawQuote: string;
};

const SS_ADJECTIVE_PLACES: [RegExp, string][] = [
  [/\b([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{3,})ick[éeáyý]\b/u, "ice"],
  [/\b([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{3,})ovsk[éeáyý]\b/u, "ov"],
  [/\b([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{3,})sk[éeáyý]\b/u, ""],
];

const SS_NOT_PLACE_ADJ = new Set([
  "ceske", "cesky", "velke", "velky", "male", "maly", "nove", "novy",
  "horske", "silnicni", "detske", "sportovni", "cyklistick", "cyklisticke", "cyklisticky",
  "prazsky", "prazske", "mestske", "terenni", "jarnim", "podzimni", "zimni",
]);

function extractSportovniServisPlace(title: string, bodyText: string): string | null {
  const mistoMatch = bodyText.match(/M[ií]sto\s*:\s*([^\n,|]+)/i);
  if (mistoMatch?.[1]) {
    const p = cleanText(mistoMatch[1]).replace(/\bv[ýy]sledky.*$/i, "").trim();
    if (p.length >= 2) return p.slice(0, 100);
  }

  // Common pattern: "neděle 30.8.2026, Doksy Máchovo jezero, mtb závod ..."
  // or "sobota 12.9.2026, Benátky nad Jizerou výsledky online"
  const afterDate = bodyText.match(/\b\d{1,2}\.\s*\d{1,2}\.\s*20\d{2}\s*,\s*([^\n]+)/);
  if (afterDate?.[1]) {
    const seg = afterDate[1]
      .split(/\s*,\s*/)[0]!
      .replace(/\b(?:v[ýy]sledky|startovn[ií]|online|propozice)\b.*$/i, "")
      .trim();
    if (
      seg.length >= 3 &&
      !/^\d+\s*\.\s*ro[čc]n[ií]k/i.test(seg) &&
      !/^(?:z[aá]vod|cyklistick|d[eé]lka|tra[tť]|hodinov|short\s*track|kolo|\d+\s*km)/i.test(seg)
    ) {
      return seg.slice(0, 100);
    }
    // Check second segment if first was e.g. "Lesopark Letňany, Praha 9" or "Svatý Petr, Špindlerův Mlýn"
    const seg2 = afterDate[1].split(/\s*,\s*/)[1]?.replace(/\b(?:v[ýy]sledky|online)\b.*$/i, "").trim();
    if (seg2 && seg2.length >= 3 && !/^\d+\s*\.\s*ro[čc]n/i.test(seg2) && !/^(?:mtb|d[eé]lka|tra[tť]|hodin)/i.test(seg2)) {
      return seg2.slice(0, 100);
    }
  }

  // Fallback to explicit Prague / town names in title or body
  const knownTown = `${title} ${bodyText}`.match(
    /\b(Praha(?:\s+\d{1,2})?|Špindlerův Mlýn|Benátky nad Jizerou|Moravská Třebová|Rakovník|Doksy|Kbely|Letňany|Motol|Mařenice|Kramolín|Kraslice|Ústí nad Labem|Chabařovice)\b/i,
  );
  if (knownTown?.[1]) return knownTown[1];

  for (const [re, tail] of SS_ADJECTIVE_PLACES) {
    const m = title.match(re);
    if (!m?.[1]) continue;
    const whole = foldCzech(m[0]);
    if (SS_NOT_PLACE_ADJ.has(whole) || whole.startsWith("cyklist")) continue;
    if (/^prazsk/i.test(whole)) return "Praha";
    if (tail) return `${m[1]}${tail}`;
  }

  return null;
}

export function parseSportovniServisPosts(posts: SportovniServisWpPost[]): SportovniServisRow[] {
  const rows: SportovniServisRow[] = [];
  const seen = new Set<string>();

  for (const post of posts) {
    const title = decodeEntities(post.title?.rendered ?? "");
    const contentHtml = post.content?.rendered ?? "";
    const sourceUrl = (post.link ?? "").trim();
    if (!title || !sourceUrl) continue;

    const $ = load(contentHtml.replace(/<\/(?:p|div|li|tr|h\d)>|<br\s*\/?>/gi, "$& "));
    const bodyText = cleanText($.text());
    const startDate = parseCzechDate(bodyText) ?? parseCzechDate(title);
    if (!startDate) continue;

    const hasCyclingTag = (post.tags ?? []).some(t => SS_CYCLING_TAGS.has(t));
    const hasCyclingCat = (post.categories ?? []).some(c => SS_CYCLING_CATS.has(c));
    if (!isCzechCyclingRace(`${title} ${bodyText}`, { trustedCyclingSource: hasCyclingTag || hasCyclingCat })) continue;

    const placeText = extractSportovniServisPlace(title, bodyText);
    if (!placeText) continue;

    const id = String(post.id || sourceUrl);
    if (seen.has(id)) continue;
    seen.add(id);

    let resultsUrl: string | undefined;
    let registrationUrl: string | undefined;
    let websiteUrl: string | undefined;

    $("a[href]").each((_, a) => {
      const href = $(a).attr("href")?.trim();
      if (!href || !/^https?:\/\//i.test(href)) return;
      const linkText = foldCzech(cleanText($(a).text()));
      if ((/sportt\.cz\/(?:datatables|racesResults|vysledky)/i.test(href) || /vysledk/i.test(linkText)) && !resultsUrl) {
        resultsUrl = href;
      } else if ((/sportt\.cz\/race/i.test(href) || /registrac|prihlas/i.test(linkText)) && !registrationUrl) {
        registrationUrl = href;
      } else if (!/sportovniservis\.cz|sportt\.cz|facebook\.com|instagram\.com/i.test(href) && !websiteUrl) {
        websiteUrl = href;
      }
    });

    rows.push({
      id,
      title,
      startDate,
      placeText,
      countryHint: detectCzOrSk(`${title} ${bodyText}`),
      discipline: inferCzechDiscipline(`${title} ${bodyText}`),
      sourceUrl,
      ...(websiteUrl ? { websiteUrl } : {}),
      ...(registrationUrl ? { registrationUrl } : {}),
      ...(resultsUrl ? { resultsUrl } : {}),
      rawQuote: cleanText(`${title} — ${bodyText}`).slice(0, 260),
    });
  }

  return rows;
}

export function parseSportovniServisArchiveHtml(html: string, archiveUrl: string): SportovniServisRow[] {
  const $ = load(html);
  const posts: SportovniServisWpPost[] = [];
  const isCyclingArchive = /\/tag\/(?:cycling|mtb|bmx)\b|\/cyklistika-2\b/i.test(archiveUrl);

  $("article").each((idx, art) => {
    const el = $(art);
    const a = el.find("h2.entry-title a, h2 a").first();
    const title = cleanText(a.text());
    const link = a.attr("href")?.trim();
    const contentHtml = el.find(".entry-content, .entry-summary").first().html() ?? el.html() ?? "";
    const idAttr = el.attr("id")?.match(/post-(\d+)/)?.[1];
    if (!title || !link) return;
    posts.push({
      id: idAttr ? Number(idAttr) : idx + 1,
      link,
      title: { rendered: title },
      content: { rendered: contentHtml },
      tags: isCyclingArchive ? [9] : [],
      categories: [],
    });
  });

  return parseSportovniServisPosts(posts);
}

export function sportovniServisParsedEvent(row: SportovniServisRow): ParsedEvent {
  return {
    externalId: `sportovniservis:${row.id}`,
    name: row.title.slice(0, 160),
    startDate: row.startDate,
    placeText: row.placeText,
    countryHint: row.countryHint,
    discipline: [row.discipline],
    sourceUrl: row.sourceUrl,
    ...(row.websiteUrl ? { websiteUrl: row.websiteUrl } : {}),
    ...(row.registrationUrl ? { registrationUrl: row.registrationUrl } : {}),
    ...(row.resultsUrl ? { resultsUrl: row.resultsUrl } : {}),
    confidence: 0.8,
    evidence: {
      quote: row.rawQuote,
      sourceUrl: row.sourceUrl,
      method: "sportovniservis_cz",
      version: "sportovniservis-v1",
    },
  };
}
