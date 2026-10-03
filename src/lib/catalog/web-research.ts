import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { recordFacts } from "@/lib/catalog/facts";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { readDocument } from "@/lib/catalog/regulation-ages";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";
import { pageIsAbout, searchableName } from "@/lib/catalog/web-finder";
import { askJson, askWithSearch, HAIKU, LlmUnavailable, SONNET, type SearchResult } from "@/lib/llm/anthropic";

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
const VERSION = "web-research-v1";

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
    maxTokens: 120,
    model: SONNET,
  });
  return { yes: json?.verdict === "yes", reason: json?.reason ?? "" };
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
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<ResearchResult> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 50;
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const skip = opts?.ids?.length ? new Set<string>() : await recentlyProbed(supabase, "web_research");
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
      const ownSite = r.website_url && !CALENDAR_WEBSITE.test(r.website_url);
      if (ownSite && r.registration_url && r.regulations_url) continue;
      if (opts?.withoutSite && ownSite) continue;
      targets.push({
        id: r.id, name: r.name, startDate: r.start_date,
        municipality: r.location?.municipality ?? null, country: r.location?.country_code ?? null,
        disciplines: r.disciplines ?? [],
        website: ownSite ? r.website_url : null, registration: r.registration_url, regulations: r.regulations_url,
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
      const known = [
        t.website ? `Known website: ${t.website}` : null,
        t.registration ? `Known registration: ${t.registration}` : null,
        t.regulations ? `Known regulations: ${t.regulations}` : null,
      ].filter(Boolean).join("\n");
      const asked = await askWithSearch<{ website?: string | null; registration?: string | null; regulations?: string | null }>({
        system: SYSTEM,
        user: `Race: ${t.name}\nDate: ${t.startDate}\nTown: ${t.municipality ?? "?"}\nCountry: ${t.country ?? "?"}\nDiscipline: ${t.disciplines.join(", ") || "?"}\n${known}`,
        model: HAIKU,
        maxSearches: 2,
      });
      result.searches += asked.searches;
      result.costUsd += asked.usage.costUsd;
      const seen = new Map(asked.results.map((r) => [norm(r.url), r] as [string, SearchResult]));
      const update: Record<string, string> = {};
      const facts: { field: string; value: string; previous: string | null; sourceUrl: string; quote?: string }[] = [];
      const consider = async (field: "website_url" | "registration_url" | "regulations_url", url: string | null | undefined, current: string | null) => {
        if (!url || current) return;
        const hit = seen.get(norm(url));
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
          facts.push({ field, value: url, previous: current, sourceUrl: url, quote: hit.title });
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
        const ok = field === "registration_url" ? (about || (platform && named)) : about;
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
        facts.push({ field, value: url, previous: current, sourceUrl: url, quote: hit.title });
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
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "web_research", "silent");
        continue;
      }
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}  (${asked.searches} searches, $${asked.usage.costUsd.toFixed(3)})\n${facts.map((f) => `       ${f.field.replace("_url", "")}: ${f.value}`).join("\n")}`);
      if (update.website_url) result.website += 1;
      if (update.registration_url) result.registration += 1;
      if (update.regulations_url) result.regulations += 1;
      if (opts?.dryRun) continue;
      await supabase.from("events").update({ ...update, updated_at: new Date().toISOString() }).eq("id", t.id);
      await recordFacts(supabase, t.id, facts, { method: "llm", model: HAIKU, version: VERSION });
      await recordProbe(supabase, t.id, "web_research", "silent");
    } catch (e) {
      if (e instanceof LlmUnavailable) {
        opts?.log?.(`stopped: ${e.message}`);
        break;
      }
      result.failed += 1;
      opts?.log?.(`FAIL ${t.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  result.costUsd = Number(result.costUsd.toFixed(3));
  return result;
}
