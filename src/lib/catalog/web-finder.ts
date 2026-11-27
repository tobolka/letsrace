import { askJson, llmAvailable, LlmUnavailable, LlmResponseError, SONNET } from "@/lib/llm/anthropic";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { htmlText } from "@/lib/catalog/regulation-ages";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";
import { fetchBot } from "@/lib/http/fetch";
import { runWebSearch, webSearchAvailable } from "@/lib/catalog/web-search";

const PAGE = 1000;
const CANDIDATE_CONCURRENCY = 3;
const RACE_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 8_000;

/** Sites that list races or talk about them; the race's own page is elsewhere. */
const NOT_THE_RACE =
  /(^|\.)(facebook|instagram|youtube|youtu\.be|twitter|x|tiktok|strava|komoot|wikipedia|google|bing|linkedin|pinterest|tripadvisor|booking|airbnb|reddit|eventbrite|eventim|ticketmaster|allevents|meetup|radsport-events|eventivsport|odjazd|sumator|kalendarzrowerowy|velo-?kalender|velokal|mtbs|bikeboard|rennrad-?news|mtb-?news|granfondoguide|runningcalendar|bikereg|cyclingstage|procyclingstats|uci|ucichallenge|worldcyclingalliance|rad-?net|federciclismo|czechcyclingfederation|pzkol|cyclingaustria|swiss-cycling|cykloserver|cyklistika|bikeshop|decathlon|amazon|ebay|olx|goo|bicitalk|finishers|pedaletricolore|radiocorsaweb|gregi|pedaletricolore|radiocorsaweb|gregi|cyclocross24|winspace|meinestadt|vicenzatoday|localgyms|cyklistikaszc|ciclismo|toscana|sportal|sport24|gazzetta|corriere|ilgiorno|ansa|tuttobiciweb|bicisport|cyclingnews|velonews|radsport-news|rad-sport|nachrichten|zeitung|merkur|lokalo|stadtwerke|kalendar|calendar|calendario|kalender|termine|events?|veranstaltungen|eventi|akce|zavody|zavod|wydarzenia|imprezy|tickets?)\./i;

/** An article, a news item or an events calendar: a page about the race, not its own. */
export function looksLikeArticleOrListing(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  const path = decodeURIComponent(u.pathname).toLowerCase();
  const host = u.hostname.toLowerCase();
  return (
    /\/20\d\d\/\d{1,2}(\/|$)/.test(path) ||
    // A report or results page on last year's race, not its home.
    /(resoconto|cronaca|report|risultati|classifica|ordine-d-arrivo|results?|ergebnisse|bericht|wyniki|vysledky|galleria|gallery|fotogalerie|foto|photos?)(\/|\.|-|$)/.test(path) ||
    /(^|\/)(news|clanky|clanek|novinky|novinka|zpravodajstvi|oznameni|tiskove-zpravy|aktuality|neuigkeiten|nieuws|novita|nowosci|aktualnosci|aktuell|aktuelles|artikel|article|articles|blog|presse|press|noticias|notizie|aktualnosci|aktuality|clanek|zpravy|zprávy|magazin|termine|veranstaltungen|veranstaltungskalender|kalender|calendar|calendario|kalendar|events?|eventi|evento|eventos|wydarzenie|wydarzenia|imprezy|akce|tickets?)(\/|\.|-|$)/.test(path) ||
    /(^|\.)(stadt|gemeinde|comune|gmina|mesto|obec|city|town|kreis)[a-z0-9-]*\./.test(host) ||
    /(news|zeitung|today|gazzett|corriere|giornale|channel|magazin|journal|presse|sport24|portal|festival|racenotify|friuleventi|audax|ivg\.|leccochannel|klosterlehnin|bad-harzburg)/.test(host)
  );
}

/**
 * An address that carries another year or another edition number than the
 * race's: ".../amatori-34-campionato-..." is not the 40th.
 */
export function namesAnotherEdition(url: string, name: string, startDate: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return false;
  }
  const year = startDate.slice(0, 4);
  const years = path.match(/(?<![0-9])20\d\d(?![0-9])/g) ?? [];
  if (years.some((y) => y !== year)) return true;
  const own = name.match(/(\d{1,3})\s*(?:°|º|\.|ª|th|st|nd|rd|\b(?:ro[cč]n[ií]k|edizione|edition))/i)?.[1];
  if (!own) return false;
  const inUrl = [...path.matchAll(/(?:^|[/-])(\d{1,3})(?:-(?:campionato|trofeo|gran|memorial|edizione|edition|rocnik|cup|coppa|premio)|\/)/g)].map((m) => m[1]);
  return inUrl.length > 0 && !inUrl.includes(own);
}

export function searchableName(name: string): string {
  return name
    .replace(/\(.*?\)/g, " ")
    .replace(/#\s*\d+\s*[-–—]?/g, " ")
    .replace(/\b(19|20)\d{2}(\s*[/-]\s*(19|20)?\d{2})?\b/g, " ")
    .replace(/\b(\d+\s*[.°^]\s*)(ročník|edycja|ausgabe|edizione|kolo|závod|round|etappe|tappa)?/gi, " ")
    .replace(/\s*[—–]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 9)
    .join(" ");
}

export function searchQuery(name: string, municipality: string | null, year: string): string {
  const base = searchableName(name);
  // The town as a word of its own: "Perl" is inside "Perlcross" and still wanted.
  const named = municipality ? new RegExp(`(^|[^\\p{L}])${municipality.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(base) : true;
  const town = municipality && !named ? ` ${municipality}` : "";
  return `${base}${town} ${year}`.trim();
}

export type SearchHit = { url: string; title: string };

/**
 * DuckDuckGo's plain-HTML results. Google answers an automated browser with
 * its "unusual traffic" page after one or two queries, so it cannot be asked
 * from a script; this one can, if asked politely — a few seconds apart.
 */
export async function searchWeb(query: string): Promise<SearchHit[]> {
  // DuckDuckGo stopped answering scripts: prefer Serper (Google index), local SearXNG, or Brave.
  const ledger = process.env.SEARCH_LEDGER_PATH;
  if (webSearchAvailable()) {
    if (ledger) {
      const { takeSearch } = await import("@/lib/catalog/race-completeness");
      if (!takeSearch(ledger, { day: Number(process.env.SEARCHES_A_DAY ?? 20), month: Number(process.env.SEARCHES_A_MONTH ?? 500) })) {
        throw new Error("search allowance used up");
      }
    }
    const { hits } = await runWebSearch(query, { count: 10 });
    return hits.map(hit => ({ url: hit.url, title: hit.title }));
  }
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const html = await res.text();
  if (/anomaly|captcha|unusual traffic/i.test(html.slice(0, 5000)) && !/result__a/.test(html)) {
    throw new Error("search asked for a human");
  }
  const hits: SearchHit[] = [];
  for (const m of html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const raw = m[1]!.replace(/&amp;/g, "&");
    const uddg = raw.match(/[?&]uddg=([^&]+)/)?.[1];
    const url = uddg ? decodeURIComponent(uddg) : raw.startsWith("//") ? `https:${raw}` : raw;
    if (!/^https?:\/\//.test(url)) continue;
    hits.push({ url, title: m[2]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() });
  }
  return hits;
}

/** Whether the page's own name or address carries the race's name. */
export function namedByThePage(url: string, title: string, name: string): boolean {
  const words = [
    ...new Set(
      fold(searchableName(name))
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !GENERIC.has(w)),
    ),
  ];
  if (!words.length) return false;
  let where = "";
  try {
    const u = new URL(url);
    where = fold(`${u.hostname} ${u.pathname}`).replace(/[^a-z0-9]+/g, "");
  } catch {
    return false;
  }
  const inUrl = words.filter((w) => where.includes(w)).length;
  const inTitle = words.filter((w) => fold(title).includes(w)).length;
  return inUrl >= Math.ceil(words.length * 0.5) || inTitle >= Math.ceil(words.length * 0.8);
}

function fold(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

const GENERIC = new Set(["cup", "race", "rennen", "zavod", "pohar", "trophy", "series", "serie", "bike", "marathon", "maraton", "gravel", "cross", "cyklokros", "mtb", "fondo", "gran", "challenge", "classic", "memorial", "trofeo", "meeting", "mistrovstvi", "mistrzostwa", "meisterschaft"]);

/**
 * Whether a page is about this race: enough of its distinctive name words,
 * and its year (or the town and date). A search result is a guess until the
 * page itself says the race's name and the right season.
 */
export function pageIsAbout(
  text: string,
  name: string,
  municipality: string | null,
  startDate: string,
): boolean {
  const t = fold(text).replace(/\s+/g, " ");
  const words = [
    ...new Set(
      fold(searchableName(name))
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !GENERIC.has(w)),
    ),
  ];
  if (!words.length) return false;
  const hit = words.filter((w) => t.includes(w)).length;
  if (hit < Math.max(1, Math.ceil(words.length * 0.6))) return false;
  // About bikes: a stud farm's racing week shares a town and a year with a
  // cyclocross and nothing else.
  const cycling = new Set(
    t.match(/\b(rad\w*|fahrrad\w*|rennrad\w*|\w*cross\w*|mtb|mountainbike\w*|gravel|bike\w*|cycl\w*|cyklo\w*|cyklist\w*|kolo|kola|kolar\w*|rower\w*|kolarst\w*|ciclis\w*|bici\w*|velo|vtt|fietsen|wielren\w*|bmx|enduro|downhill)\b/g) ?? [],
  );
  if (cycling.size < 2) return false;
  const [y, m, d] = startDate.split("-").map(Number);
  const dated =
    t.includes(String(y)) ||
    new RegExp(`\\b${d}\\.\\s?${m}\\.`).test(t) ||
    new RegExp(`\\b0?${d}[./]0?${m}\\b`).test(t);
  const town = municipality ? t.includes(fold(municipality)) : false;
  return dated && (town || words.length >= 2 || hit === words.length);
}

/**
 * Sure enough to write without a person looking: every distinctive word of the
 * race's name is on the page and in its address, the town is on it, and the
 * address is a front page or one level in — an article or a deep calendar
 * entry is never that.
 */
export function isConfidentMatch(
  url: string,
  text: string,
  name: string,
  municipality: string | null,
): boolean {
  let path = "";
  try {
    path = new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
  if (path.split("/").filter(Boolean).length > 2) return false;
  const words = [
    ...new Set(
      fold(searchableName(name))
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !GENERIC.has(w)),
    ),
  ];
  if (!words.length) return false;
  const t = fold(text).replace(/\s+/g, " ");
  const where = fold(url).replace(/[^a-z0-9]+/g, "");
  const town = municipality ? t.includes(fold(municipality)) : false;
  return words.every((w) => t.includes(w)) && words.every((w) => where.includes(w) || fold(text.slice(0, 200)).includes(w)) && town;
}

/** Does this page belong to this race? Asked of a model with the page's own text. */
export async function isTheRacesPage(
  race: { name: string; startDate: string; municipality: string | null },
  page: { url: string; title: string; text: string },
): Promise<boolean> {
  const { json } = await askJson<{ verdict?: string }>({
    system:
      "You decide whether a web page is the right link for a cycling race in a race calendar. " +
      'Answer JSON only: {"verdict":"race_page|organiser_page|registration_page|other"}. ' +
      "race_page: the race's own site or its page for this edition. organiser_page: the club or organiser's site whose page is about this race. registration_page: where riders enter this race. " +
      "other: a town or tourism page (even one describing the race), a news article, a calendar, aggregator or results platform that lists many events (finishers.com, ahotu, raceraves…), " +
      "a venue's, sports centre's or club's general front page where this race is only one item among others, another race, or another year only. When unsure, answer other.",
    user: `Race: ${race.name}\nDate: ${race.startDate}\nPlace: ${race.municipality ?? "?"}\n\nPage: ${page.url}\nTitle: ${page.title}\nText: ${page.text.replace(/\s+/g, " ").slice(0, 2500)}`,
    maxTokens: 800,
    model: SONNET,
  });
  return ["race_page", "organiser_page", "registration_page"].includes(json?.verdict ?? "");
}

export type FoundSite = { id: string; name: string; startDate: string; url: string; kind: "website" | "registration"; confident: boolean };

type CandidatePick = { url: string; kind: "website" | "registration"; confident: boolean; text: string; title: string };

function deadlineMsFromEnv(): number {
  const raw = Number(process.env.SOURCE_RUN_DEADLINE || 0);
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : Infinity;
}

/** Serialize fetches per hostname so concurrent workers never hammer a single external host. */
function createHostLimiter() {
  const chains = new Map<string, Promise<void>>();
  return {
    isBusy(host: string): boolean {
      return chains.has(host);
    },
    async run<T>(host: string, fn: () => Promise<T>): Promise<T> {
      const prev = chains.get(host) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((resolve) => {
        release = resolve;
      });
      const tail = prev.then(() => mine);
      chains.set(host, tail);
      await prev;
      try {
        return await fn();
      } finally {
        release();
        if (chains.get(host) === tail) chains.delete(host);
      }
    },
  };
}

/**
 * Inspect filtered search hits with bounded concurrency across distinct hosts,
 * aborting lower-ranked candidates as soon as a confident match is found while
 * preserving exact search-rank selection order.
 */
async function inspectCandidates(
  hits: SearchHit[],
  target: { name: string; startDate: string; municipality: string | null },
  hostLimiter: ReturnType<typeof createHostLimiter>,
  deadlineMs: number,
): Promise<{ chosen: CandidatePick | null; likely: CandidatePick | null; timedOutByDeadline: boolean }> {
  type FilteredHit = { hit: SearchHit; host: string; platform: boolean };
  const candidates: FilteredHit[] = [];
  for (const hit of hits.slice(0, 6)) {
    let host = "";
    try {
      host = new URL(hit.url).hostname.toLowerCase();
    } catch {
      continue;
    }
    const platform = isRegistrationPlatformUrl(hit.url);
    if (!platform && NOT_THE_RACE.test(`${host}.`)) continue;
    if (/\.(pdf|docx?|jpg|png)(\?|$)/i.test(hit.url)) continue;
    if (!platform && looksLikeArticleOrListing(hit.url)) continue;
    if (!platform && namesAnotherEdition(hit.url, target.name, target.startDate)) continue;
    candidates.push({ hit, host, platform });
  }
  if (!candidates.length) return { chosen: null, likely: null, timedOutByDeadline: false };

  const results: (CandidatePick | null)[] = new Array(candidates.length).fill(null);
  const controllers = candidates.map(() => new AbortController());
  const started = new Array(candidates.length).fill(false);
  let confidentCutoff = candidates.length;
  let inFlight = 0;
  let timedOutByDeadline = false;

  let notify: (() => void) | null = null;
  const waitForProgress = () =>
    new Promise<void>((resolve) => {
      notify = resolve;
    });
  const wake = () => {
    const fn = notify;
    notify = null;
    fn?.();
  };

  const nextCandidateIndex = (): number => {
    for (let i = 0; i < confidentCutoff; i += 1) {
      if (!started[i] && !hostLimiter.isBusy(candidates[i]!.host)) return i;
    }
    for (let i = 0; i < confidentCutoff; i += 1) {
      if (!started[i]) return i;
    }
    return -1;
  };

  const runOne = async (idx: number) => {
    const { hit, host, platform } = candidates[idx]!;
    const controller = controllers[idx]!;
    try {
      if (Date.now() >= deadlineMs || idx >= confidentCutoff) return;
      const pick = await hostLimiter.run(host, async () => {
        if (controller.signal.aborted || idx >= confidentCutoff) return null;
        const left = deadlineMs - Date.now();
        if (left <= 0) {
          timedOutByDeadline = true;
          return null;
        }
        const page = await fetchBot(hit.url, {
          timeoutMs: Math.min(FETCH_TIMEOUT_MS, left),
          signal: controller.signal,
        });
        if (!page.ok || !/html/i.test(page.headers.get("content-type") ?? "")) {
          await page.body?.cancel().catch(() => {});
          return null;
        }
        const text = `${hit.title} ${htmlText(await page.text())}`;
        // The page must be about this race (its text) and be the race's own
        // (its name or address says so), not a calendar that lists it.
        if (!pageIsAbout(text, target.name, target.municipality, target.startDate) || !namedByThePage(page.url || hit.url, hit.title, target.name)) {
          return null;
        }
        const finalUrl = (page.url || hit.url)
          .replace(/\/\(X\(\d\)S\([^)]*\)\)\//, "/")
          .replace(/[?&]AspxAutoDetectCookieSupport=1/, "");
        return {
          url: finalUrl,
          kind: platform ? ("registration" as const) : ("website" as const),
          confident: platform || isConfidentMatch(finalUrl, text, target.name, target.municipality),
          text,
          title: hit.title,
        };
      });
      if (pick) {
        results[idx] = pick;
        if (pick.confident && idx < confidentCutoff) {
          confidentCutoff = idx;
          for (let j = idx + 1; j < candidates.length; j += 1) {
            controllers[j]!.abort();
          }
        }
      }
    } catch {
      /* next result */
    } finally {
      inFlight -= 1;
      wake();
    }
  };

  const activeTasks = new Set<Promise<void>>();
  const deadlineTimer = Number.isFinite(deadlineMs)
    ? setTimeout(() => wake(), Math.max(0, deadlineMs - Date.now()))
    : null;
  try {
    while (true) {
      if (Date.now() >= deadlineMs) {
        timedOutByDeadline = true;
        for (const c of controllers) c.abort();
        break;
      }
      while (inFlight < CANDIDATE_CONCURRENCY) {
        const idx = nextCandidateIndex();
        if (idx === -1) break;
        started[idx] = true;
        inFlight += 1;
        const task = runOne(idx).finally(() => activeTasks.delete(task));
        activeTasks.add(task);
      }
      if (inFlight === 0) break;
      await waitForProgress();
    }
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
  await Promise.allSettled(activeTasks);

  const chosen = results.find((r, i) => i <= confidentCutoff && r?.confident) ?? null;
  const likely = chosen ? null : results.find((r) => r && !r.confident) ?? null;
  return { chosen, likely, timedOutByDeadline };
}

export async function findWebsites(opts?: {
  max?: number;
  /** Only races in these countries. */
  countries?: string[];
  dryRun?: boolean;
  delayMs?: number;
  concurrency?: number;
  deadlineMs?: number;
  log?: (line: string) => void;
  /** Also past races from this day on: their site is where next year's date gets announced. */
  from?: string;
  /** Where the not-quite-sure finds go for a person to look at. */
  onReview?: (site: FoundSite) => void;
}): Promise<{ attempted: number; found: number; reviewed: number; registration: number; silent: number; failed: number }> {
  const deadlineMs = Math.min(opts?.deadlineMs ?? Infinity, deadlineMsFromEnv());
  const result = { attempted: 0, found: 0, reviewed: 0, registration: 0, silent: 0, failed: 0 };
  if (Date.now() >= deadlineMs) return result;

  const supabase = createServerSupabase();
  const max = opts?.max ?? 300;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "web_search");
  type Target = { id: string; name: string; startDate: string; municipality: string | null };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, registration_url, website_url, location:locations(municipality, country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", opts?.from ?? today)
      // No site of its own: none, or only a calendar's page for it.
      .or("website_url.is.null,website_url.ilike.*winspace.cz*,website_url.ilike.*uci.org*,website_url.ilike.*bikeboard.at*,website_url.ilike.*raceresult.com*,website_url.ilike.*federciclismo.it*,website_url.ilike.*finishers.com*,website_url.ilike.*cyclingaustria.at*,website_url.ilike.*pzkol.pl*,website_url.ilike.*rideandrest.net*,website_url.ilike.*odjazd.pl*,website_url.ilike.*kalendarzrowerowy*,website_url.ilike.*eventivsport*,website_url.ilike.*radsport-events*,website_url.ilike.*granfondoguide*,website_url.ilike.*cyklistikaszc.sk*,website_url.ilike.*cyklokros.cz/kalendar*")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const rows = data ?? [];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      if (opts?.countries?.length && !opts.countries.includes(row.location?.country_code ?? "")) continue;
      targets.push({ id: row.id, name: row.name, startDate: row.start_date, municipality: row.location?.municipality ?? null });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const useSearchProvider = webSearchAvailable();
  const explicitDelay = opts?.delayMs;
  const concurrency = opts?.concurrency ?? (explicitDelay !== undefined && explicitDelay > 0 ? 1 : useSearchProvider || explicitDelay === 0 ? RACE_CONCURRENCY : 1);
  const hostLimiter = createHostLimiter();
  let humanChallenges = 0;
  let stopped = false;
  let pauseUntil = 0;
  let nextTarget = 0;

  const worker = async () => {
    while (!stopped) {
      if (Date.now() >= deadlineMs) {
        stopped = true;
        break;
      }
      const pauseLeft = pauseUntil - Date.now();
      if (pauseLeft > 0) {
        if (Date.now() + pauseLeft >= deadlineMs) {
          stopped = true;
          break;
        }
        await new Promise((r) => setTimeout(r, pauseLeft));
        continue;
      }
      const idx = nextTarget;
      if (idx >= targets.length) break;
      nextTarget += 1;
      const t = targets[idx]!;
      result.attempted += 1;

      // A name that is only a town and a round number ("#03 - Bad Harzburg")
      // names nothing to look for: every site of the town would match.
      const own = fold(searchableName(t.name))
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !GENERIC.has(w) && !fold(t.municipality ?? "").includes(w));
      if (!own.length) {
        result.silent += 1;
        continue;
      }
      try {
        const hits = await searchWeb(searchQuery(t.name, t.municipality, t.startDate.slice(0, 4)));
        const inspected = await inspectCandidates(hits, t, hostLimiter, deadlineMs);
        let chosen = inspected.chosen;
        let likely = inspected.likely;

        if (inspected.timedOutByDeadline && !chosen && !likely) {
          result.attempted -= 1;
          stopped = true;
          break;
        }

        // A reader checks the page before it is saved: this race's own page, or
        // its organiser's page about this edition — not a town's tourism page,
        // a sports centre's front page or a calendar.
        const candidate = chosen ?? likely;
        if (candidate && llmAvailable()) {
          const ok = await isTheRacesPage(t, candidate).catch((e) => {
            if (e instanceof LlmUnavailable || e instanceof LlmResponseError) throw e;
            return false;
          });
          chosen = ok ? { ...candidate, confident: true } : null;
          likely = null;
        }
        if (!chosen && likely) {
          result.reviewed += 1;
          opts?.onReview?.({ id: t.id, name: t.name, startDate: t.startDate, url: likely.url, kind: likely.kind, confident: false });
          if (!opts?.dryRun) await recordProbe(supabase, t.id, "web_search", "silent");
        } else if (!chosen) {
          result.silent += 1;
          if (!opts?.dryRun) await recordProbe(supabase, t.id, "web_search", "silent");
        } else {
          result.found += 1;
          if (chosen.kind === "registration") result.registration += 1;
          opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}  → ${chosen.kind}: ${chosen.url}`);
          if (!opts?.dryRun) {
            await supabase
              .from("events")
              .update({
                ...(chosen.kind === "registration" ? { registration_url: chosen.url } : { website_url: chosen.url }),
                updated_at: new Date().toISOString(),
              })
              .eq("id", t.id)
              .or(chosen.kind === "registration" ? "registration_url.is.null" : "website_url.is.null,website_url.ilike.*rideandrest.net*,website_url.ilike.*odjazd.pl*,website_url.ilike.*kalendarzrowerowy*,website_url.ilike.*eventivsport*,website_url.ilike.*radsport-events*,website_url.ilike.*granfondoguide*,website_url.ilike.*cyklistikaszc.sk*,website_url.ilike.*cyklokros.cz/kalendar*");
            await clearProbe(supabase, t.id, "web_search");
          }
        }
      } catch (e) {
        result.failed += 1;
        opts?.log?.(`FAIL ${t.name}: ${e instanceof Error ? e.message : e}`);
        if (e instanceof Error && e.message === "search allowance used up") {
          stopped = true;
          break;
        }
        // Asked to prove we are human: wait it out, once; if it persists, stop
        // rather than push — the rest is picked up by the next run.
        if (e instanceof Error && /human|HTTP 4(29|03)/.test(e.message)) {
          humanChallenges += 1;
          if (humanChallenges >= 2) {
            stopped = true;
            break;
          }
          const waitMs = 10 * 60_000;
          if (Date.now() + waitMs >= deadlineMs) {
            stopped = true;
            break;
          }
          pauseUntil = Math.max(pauseUntil, Date.now() + waitMs);
          opts?.log?.("search asked for a human; waiting ten minutes");
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
      const waitMs = explicitDelay !== undefined ? explicitDelay : useSearchProvider ? 0 : 8_000 + Math.floor(Math.random() * 4_000);
      if (waitMs > 0 && !stopped && nextTarget < targets.length) {
        if (Date.now() + waitMs >= deadlineMs) {
          stopped = true;
          break;
        }
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  };

  if (Date.now() < deadlineMs && targets.length > 0) {
    const workerCount = Math.min(Math.max(1, concurrency), targets.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }
  return result;
}
