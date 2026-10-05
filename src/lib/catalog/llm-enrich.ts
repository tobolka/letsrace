import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";
import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { AGE_CATEGORIES, DISCIPLINES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { CHAMPIONSHIP, directDocumentUrl, hintsFor, readDocument, relatedDocumentLinks } from "@/lib/catalog/regulation-ages";
import { findRegulationsUrl } from "@/lib/watcher/regulations-url";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";
import { isAggregatorUrl, isDumpListingUrl } from "@/lib/watcher/public-url";
import { relevantWindows, verifiedCategories } from "@/lib/catalog/llm-ages";
import { askJson, HAIKU, SONNET, LlmUnavailable, type LlmUsage } from "@/lib/llm/anthropic";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";
import { alreadyRead, markRead, recordFacts, textHash, type Fact } from "@/lib/catalog/facts";

/** Bump when the prompt or the checks change: pages are read again, facts carry it. */
export const ENRICH_VERSION = "enrich-v4";

/** Page reads are decisions about an event edition, not about its shared homepage. */
export function enrichmentReader(eventId: string): string {
  return `${ENRICH_VERSION}:${eventId}`;
}
const KIDS_RACE = /kids|kinder|d[ěe]ti|d[ěe]tsk|ml[aá]de|youth|jugend|nachwuchs|giovan|[žz][aá]k|dzieci|mini|pupil|scolair|jeunes|petits/i;

const PAGE = 1000;
const PRICE_IN = 1;
const PRICE_OUT = 5;
const AGGREGATOR = /rideandrest\.net|odjazd\.pl|kalendarzrowerowy|sumator|eventivsport|radsport-events|granfondoguide|facebook\.com|instagram\.com/i;
const LINK_WORDS = /registr|anmeld|iscri|p[řr]ihl[aá][šs]|zapis|entry|enter|start ?list|startovn|propoz|regulation|ausschreibung|regolamento|regulamin|reglement|kategori|categor|klassen|results|ergebnis|vysledk|výsledk|risultati|wyniki|ticket|sportsoft|raceresult|racetime|datasport|endu|dostartu|sportident|timing|evenZo|\.pdf/i;

/** Entry and timing platforms: their host alone says what a link is. */
const PLATFORM_HOST = /sportsoft|raceresult|racetime|datasport|endu\.net|dostartu|sportident|timing|evenzo|sportstiming|letsdothis|racevisuals|competit|protimer|maratonczyk|nasecasomira|sportt\.cz|4timing|chronotrack|mikatiming|webscorer/i;

const DEADLINE_WORDS =
  /uz[aá]v[eě]rk|p[řr]ihl[aá][šs]k|registrac|anmeldeschluss|nennschluss|meldeschluss|anmeldung|iscrizion|zapisy|registration|entries close|deadline|online/gi;

/** The lines around words for entering and closing dates, a little of each. */
export function deadlineWindows(text: string, budget = 2500): string {
  const flat = text.replace(/[ \t]+/g, " ");
  let out = "";
  let last = -1;
  for (const m of flat.matchAll(DEADLINE_WORDS)) {
    const i = m.index ?? 0;
    if (i < last) continue;
    const a = Math.max(0, i - 150);
    const b = Math.min(flat.length, i + 250);
    out += `${flat.slice(a, b)}\n…\n`;
    last = b;
    if (out.length > budget) break;
  }
  return out.slice(0, budget);
}

/** What a quote must say for each discipline it is evidence of. */
export const DISCIPLINE_WORDS: Record<string, RegExp> = {
  cx: /cyclo.?cross|cyklokros|p[řr]espol|prze[łl]aj|querfeldein|ciclocross|veldrit|\bcx\b|radcross|crossrennen/i,
  xco: /\bxco\b|cross.?country|olymp/i,
  xcc: /\bxcc\b|short.?track/i,
  xce: /\bxce\b|eliminator/i,
  xcm: /\bxcm\b|marat[oó]n|marathon/i,
  mtb: /\bmtb\b|mountain.?bike|horsk[eéáý]|bike.?park|\bvtt\b|fuoristrada|g[óo]rsk|bike.?marathon/i,
  dh: /downhill|\bdh\b|sjezd|discesa/i,
  enduro: /enduro/i,
  gravel: /gravel|[šs]otol|szutr|strade bianche|schotter/i,
  road: /\broad\b|silni[cč]|stra[sß]e|strada|szos|rennrad|\broute\b|radrennen|in linea/i,
  road_race: /\broad\b|silni[cč]|stra[sß]e|strada|szos|rennrad|radrennen|in linea/i,
  tt: /time.?trial|[čc]asovk|zeitfahren|crono|jazda na czas|\bitt\b|\btt\b|contre.?la.?montre|tijdrit/i,
  criterium: /kriterium|criterium/i,
  hill_climb: /hill.?climb|do vrchu|bergzeitfahren|bergrennen|cronoscalata|podjazd|bergpreis/i,
  gran_fondo: /gran.?fondo|granfondo|radmarathon|cyklomaraton|mediofondo|sportive/i,
  track: /\btrack\b|dr[áa]h|bahn|\bpista\b|velodrom/i,
  bmx: /\bbmx\b/i,
};
const REGISTRATION_WORDS = /registr|anmeld|nennung|iscri|p[řr]ihl[aá][šs]|zapis|entry|entries|enter|sign.?up|inscri|tickets?|startpl[aä]tz|meld/i;
const REGULATIONS_WORDS = /propoz|regulation|reglement|regulamin|regolamento|ausschreibung|rozpis|bulletin|guide|info.?pdf|teilnehmerinfo|rules|pravidl/i;
/** Pages that sit next to entry links and are not one: schedules, results, galleries. */
/** A platform's or club's list of all its events, or a blog category: never one race's page. */
export function isListingPage(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.search) return false;
    return /\/(events?|veranstaltungen|termine|kalender|kalendarz|kalendar|calendar|zawody|akce|category\/[^/]+(\/[^/]+)?)$/i.test(u.pathname.replace(/\/+$/, ""));
  } catch {
    return false;
  }
}

const NOT_A_LINK_FOR = /harmonogram|schedule|zeitplan|programm?e?\b|ergebnis|results?|v[ýy]sledk|wyniki|risultati|classifica|galer|gallery|foto|photo|startlist|startovn[ií] listin|news|aktuality|admission|authori[sz]ation|extras|merch|shop|hotel|accommodation|unterkunft|ubytov|parking|volunteer|helfer|press|media|sponsor|login|mein-konto|account/i;
const DEADLINE_QUOTE = /uz[aá]v[eě]rk|p[řr]ihl[aá][šs]|registr|anmeld|nennschluss|meldeschluss|iscrizi|zapis|entr|deadline|closes|bis zum|do\s+\d|until|online/i;

/**
 * A quote as the class names in it: "Herren/Damen/Junioren m/w /Senioren" is
 * four classes, "B 35-42" in a list of age groups is 35 to 42 years.
 */
export function classesInQuote(quote: string): string[] {
  // "Men A 18-34 years" is an age group of men, not the open men's class.
  const hasAges = /\d{2}\s*[-–]\s*\d{2}|\d{2}\s*\+/.test(quote);
  return quote
    .split(/\s*[\/,;|·•]\s*|\s{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 1)
    .filter((p) => !(hasAges && /^(men|women|herren|damen|m[äa]nner|frauen|mu[žz]i|[žz]eny|uomini|donne|hommes|femmes)$/i.test(p)))
    .map((p) => {
      const m = p.match(/^[A-Za-z]{0,3}\s*(\d{2})\s*[-–]\s*(\d{2})$/);
      return m && Number(m[1]) >= 10 && Number(m[1]) < Number(m[2]) ? `${p} years` : p;
    });
}

export type Enrichment = {
  isThisRace: boolean;
  disciplines: { value: string; quote: string }[];
  categories: { name: string; quote: string }[];
  registrationUrl: string | null;
  regulationsUrl: string | null;
  /** When online entry closes, as the page says: ISO date and maybe a time. */
  entryCloses: { date: string; time: string | null; quote: string } | null;
};

type Link = { url: string; text: string; context?: string };

/** The links on a page that may lead to entering, the regulations or the classes. */
export function candidateLinks(html: string, base: string): Link[] {
  const $ = cheerio.load(html);
  const out = new Map<string, Link>();
  $("a[href]").each((_, a) => {
    const raw = ($(a).attr("href") || "").trim();
    if (!raw || /^(mailto:|tel:|javascript:|#)/i.test(raw)) return;
    let url: string;
    try {
      url = new URL(raw, base).toString();
    } catch {
      return;
    }
    const text = $(a).text().replace(/\s+/g, " ").trim().slice(0, 80);
    // The words are looked for in the link's text and path, not its host: a
    // host like mtb-guentersleben.de ("enter") or an enduro club's ("endu")
    // would let every link of the site through and crowd out the real one.
    let where = url;
    try {
      const u = new URL(url);
      where = `${u.pathname}${u.search}`;
      if (PLATFORM_HOST.test(u.hostname)) where += ` ${u.hostname}`;
    } catch {
      /* keep the whole address */
    }
    if (!LINK_WORDS.test(`${text} ${where}`)) return;
    if (/facebook\.com|instagram\.com|youtube\.com|twitter\.com|linkedin\.com|wa\.me|whatsapp/i.test(url)) return;
    // What the link sits in: the line, list item or block around it.
    const block = $(a).closest("li, p, tr, td, dd, h1, h2, h3, h4, section, article, div");
    const context = (block.length ? block.text() : $(a).parent().text()).replace(/\s+/g, " ").trim().slice(0, 400);
    if (!out.has(url)) out.set(url, { url, text, context });
  });
  // Links whose own text says what they are first, so the cap never drops them.
  return [...out.values()].sort((a, b) => Number(!LINK_WORDS.test(a.text)) - Number(!LINK_WORDS.test(b.text))).slice(0, 40);
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const GENERIC_NAME = /^(race|rennen|zavod|zavody|cup|pohar|kolo|serie|series|gran|fondo|memorial|trofeo|premio|grand|prix|cross|cyklokros|mtb|gravel|road|2026|2027)$/;
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const unquote = (s: string) => s.replace(/^[„"“'«]+|[”"“'»]+$/g, "");

/** Keep only what the page really says: quotes found in the text, links found on the page. */
export function verifyEnrichment(
  raw: {
    is_this_race?: unknown;
    page_about?: unknown;
    disciplines?: { value?: unknown; quote?: unknown }[];
    categories?: { name?: unknown; quote?: unknown }[];
    registration_url?: unknown;
    regulations_url?: unknown;
    entry_closes?: { date?: unknown; time?: unknown; quote?: unknown } | null;
  } | null,
  text: string,
  links: Link[],
  /** The race's date: a link naming another season is not this edition's. */
  startDate?: string,
): Enrichment {
  const empty: Enrichment = { isThisRace: false, disciplines: [], categories: [], registrationUrl: null, regulationsUrl: null, entryCloses: null };
  if (!raw) return empty;
  const hay = norm(text);
  const urls = new Set(links.map((l) => l.url));
  const disciplines: Enrichment["disciplines"] = [];
  for (const d of raw.disciplines ?? []) {
    if (typeof d.value !== "string" || typeof d.quote !== "string") continue;
    const v = d.value.trim().toLowerCase();
    const q = norm(unquote(d.quote));
    if (!(DISCIPLINES as readonly string[]).includes(v) || v === "other") continue;
    // The quote has to name the discipline, not just be somewhere on the page.
    const word = DISCIPLINE_WORDS[v];
    if (!word || !word.test(q)) continue;
    if (q.length >= 3 && hay.includes(q) && !disciplines.some((x) => x.value === v)) disciplines.push({ value: v, quote: d.quote });
  }
  const byUrl = new Map(links.map((l) => [l.url, l]));
  const pick = (u: unknown, kind: "registration" | "regulations") => {
    if (typeof u !== "string" || !urls.has(u)) return null;
    const l = byUrl.get(u)!;
    const blob = `${l.text} ${u}`;
    if (NOT_A_LINK_FOR.test(blob)) return null;
    // A list of every event or a category page is not this race's form or rules.
    if (isListingPage(u)) return null;
    // A link that names another season is last year's form or rules.
    if (startDate) {
      const y = Number(startDate.slice(0, 4));
      const ok = new Set([y, y + 1, ...(Number(startDate.slice(5, 7)) <= 3 ? [y - 1] : [])]);
      if ((blob.match(/(?<!\d)20\d\d(?!\d)/g) ?? []).some((n) => !ok.has(Number(n)))) return null;
    }
    if (kind === "registration") return isRegistrationPlatformUrl(u) || REGISTRATION_WORDS.test(blob) ? u : null;
    return /\.pdf(\?|#|$)/i.test(u) || REGULATIONS_WORDS.test(blob) ? u : null;
  };
  let entryCloses: Enrichment["entryCloses"] = null;
  const ec = raw.entry_closes;
  if (ec && typeof ec.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ec.date) && typeof ec.quote === "string") {
    const q = norm(unquote(ec.quote));
    const earlyBird = /v[čc]asn|early|fr[üu]hbucher|sconto|zl?[ae]v|discount|rabatt|reduced|poplatek|startovn[eé]|price|cena|preis|prezzo|op[łl]at/i.test(q) && !/uz[aá]v[eě]rk|schluss|closes|chiusura|koniec|konec|end of/i.test(q);
    if (q.length >= 6 && hay.includes(q) && !earlyBird && DEADLINE_QUOTE.test(q) && quoteStatesDate(q, ec.date)) {
      const proposedTime = typeof ec.time === "string" && /^\d{1,2}:\d{2}$/.test(ec.time) ? ec.time.padStart(5, "0") : null;
      const time = proposedTime && Number(proposedTime.slice(0, 2)) < 24 && Number(proposedTime.slice(3)) < 60
        && q.includes(proposedTime.replace(/^0/, "")) ? proposedTime : null;
      entryCloses = { date: ec.date, time, quote: ec.quote };
    }
  }
  return {
    entryCloses,
    // A series or organiser page counts: it is where this race's links live.
    isThisRace: raw.is_this_race === true || raw.page_about === "this_race" || raw.page_about === "series_or_organiser",
    disciplines,
    categories: verifiedCategories({ categories: raw.categories }, text),
    registrationUrl: pick(raw.registration_url, "registration"),
    regulationsUrl: pick(raw.regulations_url, "regulations"),
  };
}

const SYSTEM =
  "You help catalogue cycling races from the organiser's own web pages. You get the race (name, date, place, what we hold) and text taken from its pages, plus a numbered list of links found on them. " +
  "Answer with JSON only, in exactly this shape: " +
  '{"page_about":"this_race|series_or_organiser|other_race|unrelated","disciplines":[{"value":"<id>","quote":"<verbatim>"}],"categories":[{"name":"<class as written>","quote":"<verbatim>"}],"registration_url":"<one of the listed links or null>","regulations_url":"<one of the listed links or null>","entry_closes":{"date":"YYYY-MM-DD","time":"HH:MM or null","quote":"<verbatim>"} or null}. ' +
  "page_about: this_race when the text is about this race; series_or_organiser when it is the site of the series or club that runs it (its calendar, entry and rules pages count); other_race when it is about a different race or another year's edition only; unrelated otherwise. " +
  "Discipline ids: xco (cross-country Olympic), xcc (short track), xce (eliminator), xcm (cross-country marathon / MTB marathon), mtb (other mountain bike), dh, enduro, gravel, road (road ride or race, generic), road_race, tt (time trial), criterium, hill_climb, gran_fondo (mass-start granfondo/marathon on road), cx (cyclocross / přespolní / Querfeldein / ciclocross / przełaj), track, bmx. " +
  "Give the discipline(s) this race is, each with a verbatim quote from the text that shows it. " +
  "categories: only classes this race states (age classes, sex classes, licence classes). registration_url: the link where a rider enters; regulations_url: the link to the regulations (propozice, Ausschreibung, regolamento). Use a link exactly as listed, or null; prefer the race's own regulations document (often a PDF) over a general page. " +
  "entry_closes: when ONLINE entry / registration closes for this race (uzávěrka přihlášek, Anmeldeschluss, Nennschluss, chiusura iscrizioni, zapisy do, registration closes), only if the text says it, with the quote that contains that date. Not the race date, not late entry on site. " +
  "Every quote must be copied exactly from the text, at most 120 characters. Never guess; leave a list empty rather than invent.";

async function askModel(
  race: { name: string; startDate: string; place: string | null; disciplines: string[]; website: string | null },
  text: string,
  links: Link[],
): Promise<{ raw: Parameters<typeof verifyEnrichment>[0]; tokensIn: number; tokensOut: number }> {
  const user =
    `Race: ${race.name}\nDate: ${race.startDate}\nPlace: ${race.place ?? "unknown"}\nWe currently hold discipline: ${race.disciplines.join(", ") || "none"}\n` +
    `Website: ${race.website ?? "none"}\n\nLinks:\n${links.map((l) => `${l.url}  [${l.text}]`).join("\n") || "(none)"}\n\nText:\n${text}`;
  const { json, usage } = await askJson<NonNullable<Parameters<typeof verifyEnrichment>[0]>>({ system: SYSTEM, user, maxTokens: 900, timeoutMs: 60_000 });
  return { raw: json, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut };
}

type AuditItem = { id: number; field: string; value: string; evidence: string };

const AUDIT_SYSTEM =
  "You check values another assistant extracted for one cycling race from its web pages. For each item decide keep or drop. " +
  "Keep only when the evidence clearly shows the value is right for THIS race and THIS edition (its name and date). " +
  "Drop when it belongs to another event or another year, is a general page (spectator tickets, venue or admission rules, merchandise, accommodation, a login), " +
  "is an on-site check-in or briefing time rather than when online entry closes, or is an early-bird price date. " +
  "A link on the race's own site or series site that is labelled as entry / registration / regulations counts, even without a date beside it, unless something points to another event or year. " +
  "Classes are our age bands, not the race's names: u7, u9, u11, u13, u15, u17 are the youth age groups (u11 = 9-10 years, u17 = 15-16), kids = any of u7-u11, youth = any of u13-u17, junior = 17-18, u23, elite = open men/women, amateur = hobby/open/unlicensed, masters = 35+. Keep a class value when every band in it is shown by the evidence and no band the evidence shows is missing. " +
  'Answer JSON only: {"items":[{"id":1,"keep":true,"why":"short"}]}.';

/** Text around where a quote or a link label sits on the pages. */
function around(all: string, needle: string, span = 350): string {
  if (!needle) return "";
  const flat = all.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(needle.toLowerCase().replace(/\s+/g, " ").slice(0, 60));
  if (at < 0) return "";
  return flat.slice(Math.max(0, at - span), at + needle.length + span);
}

/**
 * A second, stronger reader looks at each proposed value with its evidence and
 * keeps only what clearly belongs to this race. The first reader finds; this
 * one is paid to say no.
 */
async function auditProposals(
  race: { name: string; startDate: string; place: string | null },
  items: AuditItem[],
): Promise<{ keep: Set<number>; why: Map<number, string>; usage: LlmUsage | null }> {
  if (!items.length) return { keep: new Set(), why: new Map(), usage: null };
  const user =
    `Race: ${race.name}\nDate: ${race.startDate}\nPlace: ${race.place ?? "unknown"}\n\n` +
    items.map((i) => `${i.id}. ${i.field} = ${i.value}\nEvidence: ${i.evidence.slice(0, 1200)}`).join("\n\n");
  const { json, usage } = await askJson<{ items?: { id?: number; keep?: boolean; why?: string }[] }>({
    system: AUDIT_SYSTEM,
    user,
    model: SONNET,
    maxTokens: 600,
  });
  const keep = new Set<number>();
  const why = new Map<number, string>();
  for (const r of json?.items ?? []) {
    if (typeof r.id !== "number") continue;
    if (r.keep === true) keep.add(r.id);
    why.set(r.id, r.why ?? "");
  }
  return { keep, why, usage };
}

export type EnrichResult = {
  attempted: number;
  notThisRace: number;
  ages: number;
  disciplinesSet: number;
  registration: number;
  regulations: number;
  deadlines: number;
  /** Proposals the second reader turned down, and what it cost. */
  auditDropped: number;
  /** Races where the model proposed each field, and where the checks let it through. */
  proposed: Record<string, number>;
  passedRules: Record<string, number>;
  auditUsd: number;
  silent: number;
  failed: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/**
 * One reading of a race's own pages by a language model, for what the pattern
 * readers cannot tell: the discipline, the classes, the entry and regulations
 * links, and whether the page is about this race at all.
 *
 * It is held to the page. Every discipline and class carries a quote that must
 * appear in the text, a link must be one that was on the page, and a page the
 * model says is not about this race gives nothing. Where the model's
 * discipline disagrees with the one we hold, nothing is changed: the case is
 * written to the review file.
 */
export async function enrichFromPages(opts?: {
  max?: number;
  /** Last season instead of the coming one: what it states carries to this year's edition. */
  past?: boolean;
  /** Only races whose classes are missing or guessed; ignores the 30-day memory, keeps the page-text one. */
  agesOnly?: boolean;
  dryRun?: boolean;
  ids?: string[];
  /** With ids: still skip a page whose text and links are as they were when last read. */
  keepMemory?: boolean;
  fixDisciplines?: boolean;
  reviewFile?: string;
  log?: (line: string) => void;
}): Promise<EnrichResult> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "llm_v4");
  type Target = {
    id: string; name: string; startDate: string; place: string | null; web: string | null; regs: string | null;
    disciplines: string[]; existing: string[]; ageConfidence: string | null; registrationUrl: string | null; regulationsUrl: string | null; closesAt: string | null;
  };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    let q = supabase
      .from("events")
      .select("id, name, start_date, website_url, registration_url, regulations_url, registration_closes_at, disciplines, age_categories, age_confidence, location:locations(municipality)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", opts?.past ? [...ACTIVE_EVENT_STATUSES, "completed"] : [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", opts?.past ? new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10) : today)
      .lt("start_date", opts?.past ? today : "9999-12-31")
      .not("website_url", "is", null)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts?.ids?.length) q = q.in("id", opts.ids);
    const { data, error } = await q;
    if (error) throw new Error(`Loading enrichment targets: ${error.message}`);
    const rows = (data ?? []) as unknown as {
      id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; registration_closes_at: string | null;
      disciplines: string[] | null; age_categories: string[] | null; age_confidence: string | null; location: { municipality: string | null } | null;
    }[];
    for (const r of rows) {
      if (skip.has(r.id) && !opts?.ids?.length && !opts?.agesOnly) continue;
      if (opts?.agesOnly && r.age_confidence === "explicit") continue;
      if (!r.website_url || AGGREGATOR.test(r.website_url)) continue;
      // Worth a look only if something is missing or only a guess.
      const needs = opts?.past
        ? r.age_confidence !== "explicit" || !(r.disciplines ?? []).length
        : r.age_confidence !== "explicit" || !(r.disciplines ?? []).length || !r.registration_url || !r.regulations_url || !r.registration_closes_at;
      if (!needs && !opts?.ids?.length) continue;
      targets.push({
        id: r.id, name: r.name, startDate: r.start_date, place: r.location?.municipality ?? null, web: r.website_url, regs: r.regulations_url,
        disciplines: r.disciplines ?? [], existing: r.age_categories ?? [], ageConfidence: r.age_confidence,
        registrationUrl: r.registration_url, regulationsUrl: r.regulations_url, closesAt: r.registration_closes_at,
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result: EnrichResult = { attempted: targets.length, notThisRace: 0, ages: 0, disciplinesSet: 0, registration: 0, regulations: 0, deadlines: 0, auditDropped: 0, auditUsd: 0, proposed: {}, passedRules: {}, silent: 0, failed: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  const review: string[] = ["kind\tdate\trace\tholds\tmodel says\tevidence"];
  let stop = false;
  const completedReads = new Map<string, { url: string; reader: string; hash: string }>();
  const deadlines = new Map<string, { t: Target; date: string; time: string | null; quote: string }>();
  const one = async (t: Target) => {
    if (stop) return;
    try {
      const hints = hintsFor(t.name, t.startDate, t.place);
      const queue = [t.web, t.regs].filter((u): u is string => Boolean(u)).map(directDocumentUrl);
      const seen = new Set<string>();
      let text = "";
      let intro = "";
      const links: Link[] = [];
      while (queue.length && seen.size < 5) {
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        const doc = await readDocument(url).catch(() => null);
        if (!doc) continue;
        const flat = doc.text.replace(/\s+/g, " ").trim();
        if (!intro) intro = `--- ${url}\n${flat.slice(0, 2500)}\n`;
        const part = relevantWindows(doc.text, 5000) + deadlineWindows(doc.text);
        if (part.length > 200) text += `\n--- ${url}\n${part}`;
        if (doc.html) {
          for (const l of candidateLinks(doc.html, url)) if (!links.some((x) => x.url === l.url)) links.push(l);
          const related = relatedDocumentLinks(doc.html, url, hints);
          const regs = related.some((r) => r.near) ? null : findRegulationsUrl(url, doc.html);
          for (const link of [...(regs ? [directDocumentUrl(regs)] : []), ...related.map((r) => r.url)]) if (!seen.has(link)) queue.push(link);
        }
        if (text.length > 12_000) break;
      }
      const all = `${intro}${text}`.slice(0, 16_000);
      if (all.length < 300) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v4", "silent");
        return;
      }
      // The same text read by the same version gives the same answer: do not pay twice.
      const reader = enrichmentReader(t.id);
      const hash = textHash(JSON.stringify({ version: ENRICH_VERSION, race: { id: t.id, name: t.name, date: t.startDate, place: t.place, disciplines: t.disciplines }, text: all, links }));
      if ((!opts?.ids?.length || opts?.keepMemory) && (await alreadyRead(supabase, t.web!, reader, hash))) {
        result.silent += 1;
        return;
      }
      /** Find evidence within individual documents; normalised offsets are not raw offsets. */
      const sourceOf = (quote: string | undefined | null): string | null => {
        if (!quote) return null;
        const needle = norm(unquote(quote));
        for (const section of all.split(/(?:^|\n)--- /).slice(1)) {
          const line = section.indexOf("\n");
          if (line >= 0 && norm(section.slice(line + 1)).includes(needle)) return section.slice(0, line).trim();
        }
        return null;
      };
      const facts: Fact[] = [];
      const { raw, tokensIn, tokensOut } = await askModel({ name: t.name, startDate: t.startDate, place: t.place, disciplines: t.disciplines, website: t.web }, all, links.slice(0, 40));
      result.tokensIn += tokensIn;
      result.tokensOut += tokensOut;
      result.costUsd = (result.tokensIn * PRICE_IN + result.tokensOut * PRICE_OUT) / 1_000_000;
      const v = verifyEnrichment(raw, all, links, t.startDate);
      // On a calendar or federation page many races share the links: one
      // counts only if its label or its line names this race or its town.
      if (isDumpListingUrl(t.web) || isAggregatorUrl(t.web) || /kalend|calendar|termine|veranstaltungen/i.test(t.web ?? "")) {
        const own = [...new Set(fold(`${t.name} ${t.place ?? ""}`).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERIC_NAME.test(w)))];
        const names = (u: string | null) => {
          const l = links.find((x) => x.url === u);
          const blob = fold(`${l?.text ?? ""} ${l?.context ?? ""} ${u ?? ""}`);
          return own.some((w) => blob.includes(w));
        };
        if (v.registrationUrl && !names(v.registrationUrl)) v.registrationUrl = null;
        if (v.regulationsUrl && !names(v.regulationsUrl)) v.regulationsUrl = null;
      }
      for (const [k, n] of Object.entries({
        classes: [raw?.categories?.length ?? 0, v.categories.length],
        discipline: [raw?.disciplines?.length ?? 0, v.disciplines.length],
        registration: [raw?.registration_url ? 1 : 0, v.registrationUrl ? 1 : 0],
        regulations: [raw?.regulations_url ? 1 : 0, v.regulationsUrl ? 1 : 0],
        deadline: [raw?.entry_closes?.date ? 1 : 0, v.entryCloses ? 1 : 0],
      })) {
        result.proposed[k] = (result.proposed[k] ?? 0) + (n[0] ? 1 : 0);
        result.passedRules[k] = (result.passedRules[k] ?? 0) + (n[1] ? 1 : 0);
      }
      if (raw) completedReads.set(t.id, { url: t.web!, reader, hash });
      if (!v.isThisRace) {
        result.notThisRace += 1;
        review.push(`not-this-race\t${t.startDate}\t${t.name}\t${t.web}\t\t`);
        opts?.log?.(`SKIP ${t.startDate}  ${t.name}  — the page is not about this race (${t.web})`);
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v4", "silent");
        return;
      }
      const patch: Record<string, unknown> = {};
      const notes: string[] = [];

      if (t.ageConfidence !== "explicit") {
        const ages = new Set<AgeCategory>(ageCategoriesFromList(v.categories.flatMap((c) => (/\d{2}\s*[-–]\s*\d{2}/.test(c.quote) ? classesInQuote(c.quote) : [c.quote, ...classesInQuote(c.quote)])).map((name) => ({ name })), { refYear: Number(t.startDate.slice(0, 4)) }));
        const specific = [...ages].filter((a) => !["kids", "youth"].includes(a)).length;
        if (specific >= 2 && !CHAMPIONSHIP.test(t.name)) {
          const adults = [...ages].some((a) => ["junior", "u23", "elite", "amateur", "masters"].includes(a));
          const ordered = AGE_CATEGORIES.filter((a) => ages.has(a));
          // Only children's classes on a race that is not a children's race:
          // a kids' page of a bigger event. Stated alone it would hide the race
          // from every adult; leave it for a person.
          if (!adults && !KIDS_RACE.test(t.name)) {
            review.push(`kids-only\t${t.startDate}\t${t.name}\t${t.existing.join(",")}\t${ordered.join(",")}\t${v.categories[0]?.quote ?? ""}`);
          } else {
          patch.age_categories = ordered;
          patch.age_confidence = "explicit";
          patch.audience = audienceFromAgeCategories(ordered);
          notes.push(`ages ${ordered.join(",")}  ${v.categories.map((c) => `„${c.quote}“`).slice(0, 6).join(" ")}`);
          facts.push({ field: "age_categories", value: ordered, previous: t.existing, sourceUrl: sourceOf(v.categories[0]?.quote), quote: v.categories.map((c) => c.quote).join(" | ").slice(0, 1000) });
          facts.push({ field: "age_confidence", value: "explicit", previous: t.ageConfidence });
          result.ages += 1;
          }
        }
      }

      const found = v.disciplines.map((d) => d.value);
      if (found.length) {
        if (!t.disciplines.length) {
          patch.disciplines = found;
          notes.push(`discipline ${found.join(",")}  „${v.disciplines[0]!.quote}“`);
          facts.push({ field: "disciplines", value: found, previous: t.disciplines, sourceUrl: sourceOf(v.disciplines[0]!.quote), quote: v.disciplines.map((d) => d.quote).join(" | ") });
          result.disciplinesSet += 1;
        } else if (!found.some((f) => t.disciplines.includes(f))) {
          review.push(`discipline\t${t.startDate}\t${t.name}\t${t.disciplines.join(",")}\t${found.join(",")}\t${v.disciplines[0]!.quote.replace(/\s+/g, " ")}`);
          if (opts?.fixDisciplines) {
            patch.disciplines = found;
            notes.push(`discipline ${t.disciplines.join(",")} → ${found.join(",")}  „${v.disciplines[0]!.quote}“`);
            facts.push({ field: "disciplines", value: found, previous: t.disciplines, sourceUrl: sourceOf(v.disciplines[0]!.quote), quote: v.disciplines.map((d) => d.quote).join(" | ") });
            result.disciplinesSet += 1;
          }
        }
      }
      if (v.registrationUrl && !t.registrationUrl) {
        patch.registration_url = v.registrationUrl;
        notes.push(`registration ${v.registrationUrl}  [${links.find((l) => l.url === v.registrationUrl)?.text ?? ""}]`);
        facts.push({ field: "registration_url", value: v.registrationUrl, previous: null, sourceUrl: t.web, quote: links.find((l) => l.url === v.registrationUrl)?.text ?? null });
        result.registration += 1;
      }
      if (v.regulationsUrl && !t.regulationsUrl) {
        patch.regulations_url = v.regulationsUrl;
        notes.push(`regulations ${v.regulationsUrl}  [${links.find((l) => l.url === v.regulationsUrl)?.text ?? ""}]`);
        facts.push({ field: "regulations_url", value: v.regulationsUrl, previous: null, sourceUrl: t.web, quote: links.find((l) => l.url === v.regulationsUrl)?.text ?? null });
        result.regulations += 1;
      }

      // A second opinion on every proposal before anything is written.
      const items: AuditItem[] = [];
      const linkWhere = (u: unknown) => {
        const l = links.find((x) => x.url === u);
        return `link label "${l?.text ?? ""}"; the link sits in: "${l?.context ?? ""}"; found while reading ${t.web}`;
      };
      if (patch.age_categories) items.push({ id: 1, field: "classes", value: (patch.age_categories as string[]).join(", "), evidence: v.categories.map((c) => around(all, c.quote, 120) || c.quote).join(" … ") });
      if (patch.disciplines) items.push({ id: 2, field: "discipline", value: (patch.disciplines as string[]).join(", "), evidence: v.disciplines.map((d) => around(all, d.quote, 150) || d.quote).join(" … ") });
      if (patch.registration_url) items.push({ id: 3, field: "online entry link", value: String(patch.registration_url), evidence: linkWhere(patch.registration_url) });
      if (patch.regulations_url) items.push({ id: 4, field: "regulations link", value: String(patch.regulations_url), evidence: linkWhere(patch.regulations_url) });
      // An entry deadline is in the weeks before the race; a date most of a
      // year earlier is last edition's (or when entries open).
      const daysBefore = v.entryCloses ? (Date.parse(t.startDate) - Date.parse(v.entryCloses.date)) / 86_400_000 : -1;
      const deadline = !opts?.past && v.entryCloses && !t.closesAt && daysBefore > 0 && daysBefore <= 200 ? v.entryCloses : null;
      if (deadline) items.push({ id: 5, field: "online entry closes", value: `${deadline.date}${deadline.time ? ` ${deadline.time}` : ""}`, evidence: around(all, deadline.quote, 300) || deadline.quote });
      if (items.length) {
        const audit = await auditProposals({ name: t.name, startDate: t.startDate, place: t.place }, items);
        if (audit.usage) result.auditUsd += audit.usage.costUsd;
        const dropped = (id: number) => !audit.keep.has(id);
        const note = (id: number, what: string) => {
          result.auditDropped += 1;
          review.push(`audit-dropped\t${t.startDate}\t${t.name}\t${what}\t\t${audit.why.get(id) ?? ""}`);
          opts?.log?.(`  DROP ${t.name}: ${what} — ${audit.why.get(id) ?? ""}`);
        };
        if (patch.age_categories && dropped(1)) {
          note(1, `classes ${(patch.age_categories as string[]).join(",")}`);
          delete patch.age_categories; delete patch.age_confidence; delete patch.audience;
          result.ages -= 1;
          for (let i = facts.length - 1; i >= 0; i--) if (facts[i]!.field.startsWith("age_")) facts.splice(i, 1);
          notes.splice(0, notes.length, ...notes.filter((n) => !n.startsWith("ages ")));
        }
        if (patch.disciplines && dropped(2)) {
          note(2, `discipline ${(patch.disciplines as string[]).join(",")}`);
          delete patch.disciplines;
          result.disciplinesSet -= 1;
          for (let i = facts.length - 1; i >= 0; i--) if (facts[i]!.field === "disciplines") facts.splice(i, 1);
          notes.splice(0, notes.length, ...notes.filter((n) => !n.startsWith("discipline ")));
        }
        if (patch.registration_url && dropped(3)) {
          note(3, `registration ${patch.registration_url}`);
          delete patch.registration_url;
          result.registration -= 1;
          for (let i = facts.length - 1; i >= 0; i--) if (facts[i]!.field === "registration_url") facts.splice(i, 1);
          notes.splice(0, notes.length, ...notes.filter((n) => !n.startsWith("registration ")));
        }
        if (patch.regulations_url && dropped(4)) {
          note(4, `regulations ${patch.regulations_url}`);
          delete patch.regulations_url;
          result.regulations -= 1;
          for (let i = facts.length - 1; i >= 0; i--) if (facts[i]!.field === "regulations_url") facts.splice(i, 1);
          notes.splice(0, notes.length, ...notes.filter((n) => !n.startsWith("regulations ")));
        }
        // Written after the whole batch: a quote two races share is a hub
        // page's window, not this race's own.
        if (deadline && !dropped(5)) deadlines.set(t.id, { t, ...deadline });
        else if (deadline) note(5, `entry closes ${deadline.date}`);
      }

      if (!Object.keys(patch).length) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v4", "silent");
        return;
      }
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}\n      ${notes.join("\n      ")}`);
      if (opts?.dryRun) return;
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("events").update(patch).eq("id", t.id);
      if (!error) await recordFacts(supabase, t.id, facts, { method: "llm", model: HAIKU, version: ENRICH_VERSION });
      if (error) {
        completedReads.delete(t.id);
        result.failed += 1;
        await recordProbe(supabase, t.id, "llm_v4", "failed");
      } else await recordProbe(supabase, t.id, "llm_v4", "silent");
    } catch (e) {
      completedReads.delete(t.id);
      result.failed += 1;
      opts?.log?.(`FAIL ${t.name}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof LlmUnavailable) {
        stop = true;
        return;
      }
      if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v4", "failed");
    }
  };
  const { mapPool } = await import("@/lib/watcher/pool");
  await mapPool(targets, 4, one);
  result.costUsd = (result.tokensIn * PRICE_IN + result.tokensOut * PRICE_OUT) / 1_000_000 + result.auditUsd;
  const quoteCount = new Map<string, number>();
  for (const d of deadlines.values()) quoteCount.set(norm(d.quote), (quoteCount.get(norm(d.quote)) ?? 0) + 1);
  for (const d of deadlines.values()) {
    const line = `${d.t.startDate}  ${d.t.name}  entry closes ${d.date}${d.time ? ` ${d.time}` : ""}  „${d.quote}“`;
    if ((quoteCount.get(norm(d.quote)) ?? 0) > 1) {
      review.push(`shared-deadline\t${d.t.startDate}\t${d.t.name}\t\t${d.date}\t${d.quote}`);
      opts?.log?.(`SKIP ${line}  — the same window is quoted for another race`);
      continue;
    }
    result.deadlines += 1;
    opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${line}`);
    if (opts?.dryRun) continue;
    const value = `${d.date}T${d.time ?? "00:00"}:00+00:00`;
    const { data: done, error } = await supabase
      .from("events")
      .update({ registration_closes_at: value, updated_at: new Date().toISOString() })
      .eq("id", d.t.id)
      .is("registration_closes_at", null)
      .select("id");
    if (error) {
      completedReads.delete(d.t.id);
      result.failed += 1;
      continue;
    }
    if (done?.length) await recordFacts(supabase, d.t.id, [{ field: "registration_closes_at", value: `${d.date}T${d.time ?? "00:00"}:00+00:00`, previous: null, sourceUrl: d.t.web, quote: d.quote }], { method: "llm", model: HAIKU, version: ENRICH_VERSION });
  }
  // Remember only completed decisions, after the auditor and all writes finish.
  if (!opts?.dryRun) for (const read of completedReads.values()) await markRead(supabase, read.url, read.reader, read.hash);
  if (opts?.reviewFile && review.length > 1) writeFileSync(opts.reviewFile, review.join("\n") + "\n");
  return result;
}
