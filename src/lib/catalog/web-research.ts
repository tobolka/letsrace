import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { recordFacts } from "@/lib/catalog/facts";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { readDocument } from "@/lib/catalog/regulation-ages";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";
import { namesAnotherEdition, pageIsAbout, searchableName } from "@/lib/catalog/web-finder";
import { researchQueries } from "@/lib/catalog/research-queries";
import { candidateLinks, verifyEnrichment } from "@/lib/catalog/llm-enrich";
import { braveAvailable, braveSearch, BraveUnavailable } from "@/lib/catalog/brave";
import { askJson, askWithSearch, HAIKU, llmSpent, LlmUnavailable, SONNET, type SearchResult } from "@/lib/llm/anthropic";

/**
 * Look a race up the way a person does: search the web for it, open what
 * comes back, keep the race's own pages.
 *
 * The model searches and says which results are the race's site, its entry
 * page and its regulations. Code then holds that to evidence: the link must
 * be one the search returned, the page must open, and it must name this race
 * and this edition's date or year. The site is checked once more by a
 * stronger model with the page's text. Nothing the model says is written
 * without that.
 */

const PAGE = 1000;
const VERSION = "web-research-v2";

/** A race's own website is never one of these: they list many races. */
const LISTING_HOST =
  /(^|\.)(odjazd\.pl|kalendarzrowerowy\.pl|radsport-events\.de|rad-net\.de|eventivsport\.com|sumator\.cz|kalendar\.sportsoft\.cz|czechcyclingfederation\.com|cyklistikaszc\.sk|pzkol\.pl|rideandrest\.net|granfondoguide\.com|cyklokros\.cz|bikeri\.cz|finishers\.com|ahotu\.com|letsdothis\.com|strava\.com|wikipedia\.org|cykloserver\.cz|mtbiker\.sk|velo-kalender\.de|rennrad-news\.de|mtb-news\.de)$/i;

const CALENDAR_WEBSITE = /pzkol\.pl|rideandrest\.net|odjazd\.pl|kalendarzrowerowy|eventivsport|radsport-events|granfondoguide|cyklistikaszc\.sk|cyklokros\.cz\/kalendar|kalendar\.sportsoft|sumator\.cz|czechcyclingfederation/i;

const SYSTEM =
  "You find the official online sources of one cycling race edition, the way a person does with Google. " +
  "Search the web (the race name with the year, the town; try the local language). Find: " +
  "website — the race's own site or the organiser's page about this race (a Facebook page or event of the race or organiser counts only when nothing else exists); " +
  "registration — where riders enter this edition (an entry platform page is fine); " +
  "regulations — the rules or regulations for this edition (propozice, propozície, Ausschreibung, regulamin), a PDF is fine. " +
  "Calendars and aggregators that list many races (odjazd, radsport-events, sumator, the federation's calendar…), news articles and results pages are not the race's own pages. " +
  "Only give URLs exactly as they appear in your search results; never build or guess one. Leave a field null when you did not find it. " +
  'After searching, answer with JSON only: {"website":null,"registration":null,"regulations":null}';

type Target = {
  id: string;
  name: string;
  startDate: string;
  municipality: string | null;
  country: string | null;
  disciplines: string[];
  website: string | null;
  registration: string | null;
  regulations: string | null;
  previousWebsite?: string | null;
};

function norm(u: string): string {
  return u.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
}

function host(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function fold(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/** The distinctive words of a race's name. */
function nameWords(name: string): string[] {
  const generic = /^(cup|race|rennen|zavod|pohar|trophy|series|serie|bike|marathon|maraton|gravel|cross|mtb|gran|fondo|kolo|etap|stage|runde|lauf|wyscig|memorial)$/;
  return [...new Set(fold(searchableName(name)).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !generic.test(w)))];
}

function namesTheRace(text: string, name: string): boolean {
  const words = nameWords(name);
  if (!words.length) return false;
  const t = fold(text);
  return words.filter((w) => t.includes(w)).length >= Math.max(1, Math.ceil(words.length * 0.6));
}

/** Regulations are a document, or a page that says it is the rules. */
const RULES_PATH = /\.(pdf|docx?)(\?|$)|regulamin|propozic|ausschreib|reglement|regulation|rules|regeln|pravidl|_data\/\d+\//i;

/** An entry page says so in its address, or is on an entry platform. */
const ENTRY_PATH = /regist|anmeld|nennung|meldung|zapis|prihl|přihl|prihlas|entry|entries|signup|sign-up|zglos|zgłos|tickets?|startplatz/i;

/** The page's text around where it names the race, for the auditor. */
function aroundName(text: string, name: string): string {
  const flat = text.replace(/\s+/g, " ");
  const f = fold(flat);
  const spots = nameWords(name).map((w) => f.indexOf(w)).filter((i) => i >= 0);
  const at = spots.length ? Math.max(0, Math.min(...spots) - 300) : 0;
  return flat.slice(at, at + 3000);
}

/**
 * The stronger model's look at a page before it becomes a race's website: is
 * this the race's or its organiser's page for this race? Its reason is kept
 * in the log, so a wrong no can be seen.
 */
async function isOwnPage(t: Target, page: { url: string; title: string; text: string }): Promise<{ yes: boolean; reason: string }> {
  const { json } = await askJson<{ verdict?: string; reason?: string }>({
    system:
      "You check a link before it is saved as a cycling race's website. " +
      "yes: the race's own site, or the organiser's (club's) page or post announcing this race — also when it covers a second race of the same weekend, and when the date is given without the year. " +
      "no: a calendar or aggregator listing many races, a news or results article, a town or tourism page, a different race, or only another year's edition. " +
      'Answer JSON only: {"verdict":"yes|no","reason":"short"}',
    user: `Race: ${t.name}\nDate: ${t.startDate}\nTown: ${t.municipality ?? "?"}\n\nPage: ${page.url}\nTitle: ${page.title}\nText: ${aroundName(page.text, t.name)}`,
    maxTokens: 400,
    model: SONNET,
  });
  return { yes: json?.verdict === "yes", reason: json?.reason ?? "" };
}

type Asked = {
  json: { website?: string | null; registration?: string | null; regulations?: string | null } | null;
  results: SearchResult[];
  searches: number;
  usage: { costUsd: number };
};

/** The model searches on its own (Anthropic's web search): dearer, used without a Brave key. */
async function searchWithModel(t: Target): Promise<Asked> {
  const known = [
    t.website ? `Known website: ${t.website}` : null,
    t.registration ? `Known registration: ${t.registration}` : null,
    t.regulations ? `Known regulations: ${t.regulations}` : null,
  ].filter(Boolean).join("\n");
  return askWithSearch<NonNullable<Asked["json"]>>({
    system: SYSTEM,
    user: `Race: ${t.name}\nDate: ${t.startDate}\nTown: ${t.municipality ?? "?"}\nCountry: ${t.country ?? "?"}\nDiscipline: ${t.disciplines.join(", ") || "?"}\n${known}`,
    model: HAIKU,
    maxSearches: 2,
  });
}

const SOCIAL = /(^|\.)(instagram|youtube|youtu|twitter|x|tiktok|strava|komoot|linkedin|pinterest|reddit|wikipedia|trainerday|veloplanner|bikemap|ridewithgps|tripadvisor|booking)\.[a-z]+$/i;
const NOT_THE_PAGE = /lista[_-]?uczestnik|startlist|startliste|start-list|ergebnis|results?(\/|\.|$|\?)|wyniki|vysledk|výsledk|klasyfikac|galeri|gallery|fotos?\b|photos?\b/i;

const PICK_SYSTEM =
  "You are given numbered web search results for one cycling race edition. Say which result is " +
  "website: the race's own site, or its organiser's page for this race (a Facebook page of the race only if nothing else fits); " +
  "registration: where riders enter THIS race and edition — not another stage or round of the same series, not a list of entrants, not results; " +
  "regulations: the rules or regulations for this edition (propozice, propozície, Ausschreibung, regulamin). " +
  "Never pick a calendar or aggregator listing many races, a news article, results, another year's edition, or another stage/round of the series. " +
  'Give the result numbers, null when none fits. JSON only: {"website":null,"registration":null,"regulations":null}';

/**
 * Targeted Brave searches; code drops what is never a race's page; the model only
 * says which of the numbered results is which, so it cannot make up an address.
 */
export async function searchAndPick(t: Target, log?: (line: string) => void): Promise<Asked> {
  const picked: NonNullable<Asked["json"]> = {};
  const results = new Map<string, SearchResult>();
  const read = new Set<string>();
  let searches = 0;
  let costUsd = 0;
  // Follow known organiser links before paying for search or a model selection.
  const followSite = async (site: string | null | undefined) => {
    if (!site || read.has(site)) return;
    read.add(site);
    const doc = await readDocument(site).catch(() => null);
    if (!doc?.html) return;
    for (const link of candidateLinks(doc.html, site)) {
      const verified = verifyEnrichment({ is_this_race: true, registration_url: link.url, regulations_url: link.url }, doc.text, [link], t.startDate);
      if (!t.registration && !picked.registration && verified.registrationUrl) picked.registration = verified.registrationUrl;
      if (!t.regulations && !picked.regulations && verified.regulationsUrl) picked.regulations = verified.regulationsUrl;
      results.set(link.url, { url: link.url, title: link.text });
    }
  };
  await followSite(t.website);
  const complete = () => Boolean(t.website || picked.website) && Boolean(t.registration || picked.registration) && Boolean(t.regulations || picked.regulations);
  const queried = new Set<string>();
  const hits = new Map<string, Awaited<ReturnType<typeof braveSearch>>[number]>();
  // Adaptive: a successful first search can make every following one unnecessary.
  while (!complete() && searches < 4) {
    const query = researchQueries({ ...t, website: t.website || picked.website || null,
      registration: t.registration || picked.registration || null, regulations: t.regulations || picked.regulations || null })
      .find((q) => !queried.has(q));
    if (!query) break;
    queried.add(query);
    const found = await braveSearch(query, { country: t.country, count: 10 });
    searches += 1;
    log?.(`  search "${query}": ${found.length} results`);
    for (const hit of found) if (!hits.has(hit.url)) hits.set(hit.url, hit);
    const kept = [...hits.values()].filter((h) => {
      const hh = host(h.url);
      if (!hh || SOCIAL.test(hh)) return false;
      if (isRegistrationPlatformUrl(h.url)) return !NOT_THE_PAGE.test(h.url);
      if (LISTING_HOST.test(hh) || NOT_THE_PAGE.test(h.url)) return false;
      if (namesAnotherEdition(h.url, t.name, t.startDate)) return false;
      // Announcements on organiser websites are audited after selection.
      return !/\/(calendar|kalender|calendario|events?|termine)\/?$/i.test(new URL(h.url).pathname);
    }).slice(0, 30);
    for (const h of kept) results.set(h.url, { url: h.url, title: h.title });
    if (!kept.length) continue;
    const list = kept.map((h, i) => `${i + 1}. ${h.url}\n   ${h.title}\n   ${h.description.slice(0, 600)}`).join("\n");
    const { json, usage } = await askJson<{ website?: number | null; registration?: number | null; regulations?: number | null }>({
      system: PICK_SYSTEM,
      user: `Race: ${t.name}\nDate: ${t.startDate}\nTown: ${t.municipality ?? "?"}\nCountry: ${t.country ?? "?"}\n\nResults:\n${list}`,
      model: HAIKU, maxTokens: 400,
    });
    costUsd += usage.costUsd;
    const at = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n > 0 ? kept[n - 1]?.url ?? null : null;
    picked.website ||= at(json?.website);
    picked.registration ||= at(json?.registration);
    picked.regulations ||= at(json?.regulations);
    await followSite(picked.website);
  }
  return { json: picked, results: [...results.values()], searches, usage: { costUsd } };
}

export type ResearchResult = {
  attempted: number;
  website: number;
  registration: number;
  regulations: number;
  rejected: number;
  silent: number;
  failed: number;
  searches: number;
  costUsd: number;
};

export async function researchRaces(opts?: {
  max?: number;
  countries?: string[];
  ids?: string[];
  /** Only races with no site of their own. */
  withoutSite?: boolean;
  /** For a test against known answers: look as if the race had no links yet. Never writes. */
  ignoreKnown?: boolean;
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<ResearchResult> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 50;
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  if (opts?.ignoreKnown) opts = { ...opts, dryRun: true };
  const skip = opts?.ids?.length ? new Set<string>() : await recentlyProbed(supabase, "web_research_v2");
  const targets: Target[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("events")
      .select("id, name, start_date, disciplines, website_url, registration_url, regulations_url, location:locations(municipality, country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .neq("event_type", "ride")
      .in("status", [...ACTIVE_EVENT_STATUSES]);
    q = opts?.ids?.length ? q.in("id", opts.ids) : q.gte("start_date", today).lte("start_date", until);
    const { data, error } = await q.order("start_date", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as {
      id: string; name: string; start_date: string; disciplines: string[] | null;
      website_url: string | null; registration_url: string | null; regulations_url: string | null;
      location: { municipality: string | null; country_code: string | null } | null;
    }[];
    for (const r of rows) {
      if (skip.has(r.id)) continue;
      if (opts?.countries?.length && !opts.countries.includes(r.location?.country_code ?? "")) continue;
      if (opts?.ignoreKnown) {
        r.website_url = null;
        r.registration_url = null;
        r.regulations_url = null;
      }
      const ownSite = r.website_url && !CALENDAR_WEBSITE.test(r.website_url);
      if (ownSite && r.registration_url && r.regulations_url) continue;
      if (opts?.withoutSite && ownSite) continue;
      targets.push({
        id: r.id, name: r.name, startDate: r.start_date,
        municipality: r.location?.municipality ?? null, country: r.location?.country_code ?? null,
        disciplines: r.disciplines ?? [],
        website: ownSite ? r.website_url : null, previousWebsite: r.website_url, registration: r.registration_url, regulations: r.regulations_url,
      });
    }
    if (rows.length < PAGE) break;
  }
  // Races with no site of their own first: a site is where everything else is found.
  targets.sort((a, b) => Number(Boolean(a.website)) - Number(Boolean(b.website)) || a.startDate.localeCompare(b.startDate));
  targets.splice(max);

  const result: ResearchResult = { attempted: targets.length, website: 0, registration: 0, regulations: 0, rejected: 0, silent: 0, failed: 0, searches: 0, costUsd: 0 };
  for (const t of targets) {
    try {
      const asked = braveAvailable() ? await searchAndPick(t, opts?.log) : await searchWithModel(t);
      result.searches += asked.searches;
      result.costUsd += asked.usage.costUsd;
      const seen = new Map(asked.results.map((r) => [norm(r.url), r] as [string, SearchResult]));
      const update: Record<string, string> = {};
      const facts: { field: string; value: string; previous: string | null; sourceUrl: string; quote?: string }[] = [];
      const consider = async (field: "website_url" | "registration_url" | "regulations_url", url: string | null | undefined, current: string | null) => {
        if (!url || current) return;
        if (!/^https?:\/\//i.test(url)) {
          if (!/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return;
          url = `https://${url}`;
        }
        // A site's front page whose deeper pages the search returned came from the search too.
        const front = (() => { try { const u = new URL(url); return u.pathname.replace(/\/+$/, "") === "" ? host(url) : null; } catch { return null; } })();
        const hit = seen.get(norm(url)) ?? (front ? asked.results.find((r) => host(r.url) === front) : undefined);
        if (!hit) {
          result.rejected += 1;
          opts?.log?.(`  NOT IN RESULTS ${field}: ${url}`);
          return;
        }
        const h = host(url);
        const platform = isRegistrationPlatformUrl(url);
        if (LISTING_HOST.test(h) && !(field === "registration_url" && platform)) {
          result.rejected += 1;
          opts?.log?.(`  LISTING ${field}: ${url}`);
          return;
        }
        // Facebook does not open for a script: the result's title has to name the race.
        if (/(^|\.)facebook\.com$/.test(h)) {
          if (field !== "website_url" || !namesTheRace(hit.title, t.name)) {
            result.rejected += 1;
            opts?.log?.(`  FACEBOOK ${field}: ${url} (${hit.title})`);
            return;
          }
          update[field] = url;
          facts.push({ field, value: url, previous: field === "website_url" ? t.previousWebsite ?? current : current, sourceUrl: url, quote: hit.title });
          return;
        }
        // Last year's regulations, or an entry platform's section page rather than this race's form.
        if (namesAnotherEdition(url, t.name, t.startDate) || /\b20(1\d|2[0-5])\b/.test(decodeURIComponent(url).replace(/^[^/]+\/\/[^/]+/, "")) && !decodeURIComponent(url).includes(t.startDate.slice(0, 4))) {
          result.rejected += 1;
          opts?.log?.(`  OTHER YEAR ${field}: ${url}`);
          return;
        }
        if (field === "registration_url" && platform && !/\d{2,}/.test(url.replace(/^[^/]+\/\/[^/]+/, ""))) {
          result.rejected += 1;
          opts?.log?.(`  NOT A FORM ${field}: ${url}`);
          return;
        }
        const doc = await readDocument(url).catch(() => null);
        const text = `${hit.title} ${doc?.text ?? ""}`;
        if (!doc || doc.text.length < 40) {
          result.rejected += 1;
          opts?.log?.(`  DID NOT OPEN ${field}: ${url}`);
          return;
        }
        const about = pageIsAbout(text, t.name, t.municipality, t.startDate);
        const named = namesTheRace(text, t.name);
        // A front page often has no date on it: for the site, naming the race
        // (in its text or its address) is enough here, the auditor decides.
        const inHost = nameWords(t.name).some((w) => w.length >= 5 && fold(h).replace(/[^a-z0-9]/g, "").includes(w));
        const ok =
          field === "registration_url" ? about || (platform && named)
          : field === "website_url" ? about || named || inHost
          : about;
        if (!ok) {
          result.rejected += 1;
          opts?.log?.(`  NOT THIS RACE ${field}: ${url}`);
          return;
        }
        if (field === "website_url") {
          const audit = await isOwnPage(t, { url, title: hit.title, text: doc.text });
          if (!audit.yes) {
            result.rejected += 1;
            opts?.log?.(`  AUDIT SAID NO website: ${url} — ${audit.reason}`);
            return;
          }
        }
        update[field] = url;
        facts.push({ field, value: url, previous: field === "website_url" ? t.previousWebsite ?? current : current, sourceUrl: url, quote: hit.title });
      };
      opts?.log?.(`  model: ${JSON.stringify(asked.json)}`);
      let site = asked.json?.website;
      let entry = asked.json?.registration;
      // A race's site given as its entry page: it is the site.
      if (entry && !isRegistrationPlatformUrl(entry) && !ENTRY_PATH.test(entry)) {
        if (!site) site = entry;
        entry = null;
      }
      await consider("website_url", site, t.website);
      await consider("registration_url", entry, t.registration);
      const rules = asked.json?.regulations;
      await consider("regulations_url", rules && RULES_PATH.test(rules) && norm(rules) !== norm(site ?? "") ? rules : null, t.regulations);
      if (!facts.length) {
        result.silent += 1;
        opts?.log?.(`--   ${t.startDate}  ${t.name}  (${asked.searches} searches, $${asked.usage.costUsd.toFixed(3)})`);
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "web_research_v2", "silent");
        continue;
      }
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}  (${asked.searches} searches, $${asked.usage.costUsd.toFixed(3)})\n${facts.map((f) => `       ${f.field.replace("_url", "")}: ${f.value}`).join("\n")}`);
      if (update.website_url) result.website += 1;
      if (update.registration_url) result.registration += 1;
      if (update.regulations_url) result.regulations += 1;
      if (opts?.dryRun) continue;
      const { error } = await supabase.from("events").update({ ...update, updated_at: new Date().toISOString() }).eq("id", t.id);
      if (error) throw new Error(`Saving research: ${error.message}`);
      await recordFacts(supabase, t.id, facts, { method: "llm", model: HAIKU, version: VERSION });
      await recordProbe(supabase, t.id, "web_research_v2", "silent");
    } catch (e) {
      if (e instanceof LlmUnavailable || e instanceof BraveUnavailable) {
        opts?.log?.(`stopped: ${e.message}`);
        break;
      }
      result.failed += 1;
      opts?.log?.(`FAIL ${t.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Everything this run paid for, the auditor's checks included.
  result.costUsd = Number(llmSpent().toFixed(3));
  return result;
}
