/** Read-only, resumable audit. No AI calls and no catalogue writes.
 * node scripts/with-node.cjs tsx scripts/audit-next-edition-websites.ts [2026] [--replay=ARCHIVE_DIR]
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
import * as cheerio from "cheerio";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fetchPage } from "../src/lib/watcher/http";
import { extractJsonLdEvents } from "../src/lib/watcher/extractors/jsonld";
import { hostnameOf, sleep } from "../src/lib/watcher/pool";
import { renderPagesHtml } from "../src/lib/watcher/extractors/csc-render";
import { editionKey } from "../src/lib/catalog/previous-edition";
import { defaultEditionSeason } from "../src/lib/catalog/edition-season";
import { isDumpListingUrl } from "../src/lib/watcher/public-url";
import { isRegistrationPlatformUrl } from "../src/lib/watcher/registration-url";
import { asksToVerifyVisitor } from "../src/lib/catalog/practical-sources";

type Race = { id: string; slug: string; name: string; start_date: string; website_url: string | null; location: { municipality: string | null; country_code: string | null } | null };
type RaceSnapshot = { year: number; target: number; old: Race[]; existing: Race[] };
type Job = { url: string; via: string[]; purpose: string };
const args = process.argv.slice(2);
const replayDir = args.find(arg => arg.startsWith("--replay="))?.slice("--replay=".length);
if (args.some(arg => arg.startsWith("--replay")) && !replayDir) throw new Error("Use --replay=ARCHIVE_DIR");
const replay = replayDir ? JSON.parse(readFileSync(join(replayDir, "races.json"), "utf8")) as RaceSnapshot : undefined;
if (!replay) for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
const year = Number(args.find(arg => !arg.startsWith("--")) ?? replay?.year ?? defaultEditionSeason());
if (!Number.isInteger(year) || year < 2020 || year > 2090) throw new Error("Invalid season");
const target = year + 1;
if (replay && (year !== replay.year || target !== replay.target || !Array.isArray(replay.old) || !Array.isArray(replay.existing))) {
  throw new Error("Invalid replay race snapshot or season mismatch");
}
const retryErrors = args.includes("--retry-errors");
const retryShort = args.includes("--retry-short");
const option = (name: string) => args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const seconds = Number(option("seconds") ?? 3600), limit = Number(option("limit") ?? 100000);
if (!Number.isFinite(seconds) || seconds < 1 || !Number.isInteger(limit) || limit < 1) throw Error("Invalid reading limits");
const deadline = Date.now()+seconds*1000;
const countries = option("countries")?.split(",");
if(countries?.some(c=>!(/^[A-Z]{2}$/.test(c)))) throw Error("Invalid countries");
let stopping=false, requestsThisPass=0;
for(const signal of ["SIGTERM","SIGINT"] as const)process.on(signal,()=>{stopping=true;});
if (replay && retryErrors) throw new Error("Retry requires a live audit");
const deferHost = process.argv.find(arg => arg.startsWith("--defer-host="))?.split("=")[1];
const pausedHosts = new Set(deferHost ? [deferHost] : []);
const country = args.find(arg => arg.startsWith("--country="))?.slice("--country=".length).toUpperCase();
if (country && (replay || !/^[A-Z]{2}$/.test(country))) throw new Error("Use --country=CC with a live audit");
const rateLimitStreaks = new Map<string, number>();
const runDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const archive = replayDir ?? option("out") ?? `reports/next-edition-websites-${year}-to-${target}-${runDay}${country ? `-${country.toLowerCase()}` : ""}`;
const directory = replay ? join(archive, "replay") : archive;
mkdirSync(replay ? directory : join(directory, "pages"), { recursive: true });
type Page = Job & { asksVerification?: boolean; at: string; requestAttempted?: boolean; status?: number; finalUrl?: string; title?: string; textLength?: number; error?: string; snippets?: string[]; dateSignals?: string[]; structuredEvents?: ReturnType<typeof extractJsonLdEvents>; follow?: string[]; textFile?: string; needsBrowser?: boolean; rendered?: boolean };
const canonical = (raw: string): string | null => {
  try { const u = new URL(raw); if (!/^https?:$/.test(u.protocol)) return null; u.hash = ""; return u.href; } catch { return null; }
};
/** One event's page on a timing or listing platform: next year's event gets a new page there. */
const PLATFORM_ONLY = /(?:^|\.)(?:my\.raceresult\.com|odjazd\.pl|dostartu\.pl)$/i;
const isPlatformOnly = (url: string | null) => { try { return PLATFORM_ONLY.test(new URL(url ?? "").hostname); } catch { return false; } };
const keyOf = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 20);
/** Written before a request. If this stays the last line for a page, reading it killed the pass. */
const READING = "read_interrupted: the pass stopped while reading this page";
const isFailure = (page: Page) => Boolean(page.error || (page.status ?? 0) >= 400);
const pages = new Map<string, Page>();
const jobs = new Map<string, Job>();
const attempted = new Set<string>();
const activeHosts = new Map<string, number>();
const hostStarts = new Map<string, number>();
const ledger = join(archive, "pages.jsonl");
if (replay && !existsSync(ledger)) throw new Error("Replay archive is missing pages.jsonl");
const browserOff = args.includes("--no-browser");
const asksForVerification = asksToVerifyVisitor;
const wantsScript = (flat: string) => flat.length < 300 || /enable javascript|javascript (?:is required|aktivieren)/i.test(flat);
const BROWSER_READS_PER_PASS = 40;
let browserReads = 0;
const failures = new Map<string, number>();
if (existsSync(ledger)) for (const line of readFileSync(ledger, "utf8").trim().split("\n").filter(Boolean)) {
  // A pass killed mid-line must not cost the whole record.
  let page: Page; try { page = JSON.parse(line) as Page; } catch { continue; }
  // An interrupted read counts once its outcome is known: the next line, or none.
  if (pages.get(page.url)?.error === READING && page.error === READING) failures.set(page.url, (failures.get(page.url) ?? 0) + 1);
  pages.set(page.url, page);
  if (page.error !== READING) failures.set(page.url, isFailure(page) ? (failures.get(page.url) ?? 0) + 1 : 0);
}
for (const page of pages.values()) if (page.error === READING) failures.set(page.url, (failures.get(page.url) ?? 0) + 1);
// A page once taken for a robot check is judged again from its saved text, so an improved check applies without a new request.
for (const page of pages.values()) if (page.asksVerification && !page.rendered && page.textFile && existsSync(join(archive, page.textFile))) {
  const flat = readFileSync(join(archive, page.textFile), "utf8").split("\n").slice(1).join(" ").replace(/\s+/g, " ");
  page.asksVerification = asksForVerification(flat);
  page.needsBrowser = page.asksVerification || wantsScript(flat);
}
const HOUR = 3600_000, DAY = 24 * HOUR;
/** How long a page read without trouble rests before it is read again. */
const REREAD_DAYS = 5;
/** When this page is worth reading again: a site that keeps failing is asked ever more rarely. */
function rereadAt(page: Page): number {
  const at = Date.parse(page.at);
  if (page.requestAttempted === false) return at + 7 * DAY; // The site itself asked us to stop.
  // A robot check is never passed, so asking again soon only repeats the refusal.
  if (page.asksVerification && !page.error) return at + 7 * DAY;
  // Seen through a browser, or not yet: the browser has a per-pass allowance, so a page left over waits a little, not a whole cycle each time.
  if (page.needsBrowser && !page.error) return page.rendered ? at + 14 * DAY : at + 6 * HOUR;
  if (isFailure(page)) return at + Math.min(14 * DAY, 6 * HOUR * 2 ** Math.max(0, (failures.get(page.url) ?? 1) - 1));
  // An organiser's page that said nothing about next year is the one most likely to say it soon.
  return at + REREAD_DAYS * DAY;
}
for (const page of pages.values()) {
  const stale = option("out") && Date.now() >= rereadAt(page);
  if (stale || retryErrors && (page.error || page.status === 429 || (page.status ?? 0) >= 500) || retryShort && page.needsBrowser && page.rendered && !page.error) pages.delete(page.url);
  else attempted.add(page.url);
}
function enqueue(raw: string, via: string, purpose: string) {
  const url = canonical(raw); if (!url || isPlatformOnly(url)) return;
  const held = jobs.get(url);
  if (held) { if (!held.via.includes(via)) held.via.push(via); return; }
  jobs.set(url, { url, via: [via], purpose });
}

async function readRaces(from: string, until: string): Promise<Race[]> {
  const db = createServerSupabase(); const rows: Race[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("events").select("id,slug,name,start_date,website_url,location:locations(municipality,country_code)")
      .eq("visibility", "public").is("merged_into_id", null).or("event_type.is.null,event_type.neq.ride").gte("start_date", from).lt("start_date", until).order("id").range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...data); if (data.length < 1000) break;
  }
  return rows;
}

function yearSnippets(text: string): string[] {
  const out: string[] = []; const re = new RegExp(`\\b${target}\\b`, "g"); let match;
  while ((match = re.exec(text)) && out.length < 100) {
    const context = text.slice(Math.max(0, match.index - 200), match.index + 220).trim();
    if (!out.includes(context)) out.push(context);
  }
  return out;
}
function dateSignals(text: string): string[] {
  const y = String(target);
  // Leads only: ranges, publication dates and registration dates require review.
  const month = "(?:" + ("jan january januar jänner gennaio leden ledna január januára styczeń stycznia feb february februar febbraio únor února február februára luty lutego mar march märz maerz marzo březen března marec marca marzec apr april aprile duben dubna apríl apríla kwiecień kwietnia may mai maggio květen května máj mája maj maja jun june juni giugno červen června jún júna czerwiec czerwca jul july juli luglio červenec července júl júla lipiec lipca aug august agosto srpen srpna augusta sierpień sierpnia sep sept september settembre září septembra wrzesień września oct october oktober ottobre říjen října október októbra październik października nov november novembre listopad listopadu novembra listopada dec december dez dezember dicembre prosinec prosince decembra grudzień grudnia").split(" ").join("|") + ")";
  const firstDay = String.raw`(?:\d{1,2}\.?\s*[-–—/]\s*)?`;
  const day = String.raw`\d{1,2}(?:st|nd|rd|th)?`;
  const patterns = [
    `${y}[-/.]\\d{1,2}[-/.]\\d{1,2}`,
    `${firstDay}\\d{1,2}[-./]\\s*\\d{1,2}[-./]\\s*${y}`,
    `${firstDay}${day}\\.?\\s+${month}\\.?\\s*,?\\s*${y}`,
    `${month}\\s+${firstDay}${day}\\s*,?\\s*${y}`,
  ];
  const dates = new RegExp(`(?<![\\p{L}\\p{N}])(?:${patterns.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return [...new Set([...text.matchAll(dates)].map(m => m[0]))];
}
const requestFailed = (page: Page) => Boolean(page.error || page.requestAttempted === false || !page.status || page.status < 200 || page.status >= 300);
const unreadable = (page: Page) => requestFailed(page) || Boolean(page.needsBrowser);
const hasDate = (page: Page) => !requestFailed(page) && Boolean(page.dateSignals?.length || page.structuredEvents?.length);
const reportTextPath = (file: string | undefined) => replay && file ? `../${file}` : file;
async function inspect(job: Job, viaBrowser = false): Promise<Page> {
  const base = { ...job, at: new Date().toISOString() };
  if (pausedHosts.has(hostnameOf(job.url))) return { ...base, requestAttempted: false, error: "deferred_rate_limit: source host repeatedly returned HTTP 429 after cooldowns; this URL was not requested" };
  try {
    let response: { html: string; status: number; finalUrl?: string };
    if (viaBrowser) {
      const html = (await renderPagesHtml([job.url], { settleMs: 2500, budgetMs: 30_000 })).get(job.url);
      if (!html) return { ...base, rendered: true, needsBrowser: true, error: "browser_render_empty" };
      response = { html, status: 200, finalUrl: job.url };
    } else response = await fetchPage(job.url, { timeoutMs: retryErrors ? 25_000 : 15_000, retries: 0, skipGate: true, fresh: true });
    const $ = cheerio.load(response.html);
    const title = $("title").text().replace(/\s+/g, " ").trim();
    const follow: { url: string; score: number }[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")!; let url: URL;
      try { url = new URL(href, response.finalUrl ?? job.url); } catch { return; }
      if (hostnameOf(url.href) !== hostnameOf(response.finalUrl ?? job.url) || !/^https?:$/.test(url.protocol)) return;
      const label = $(el).text().replace(/\s+/g, " ").trim(); const blob = `${url.pathname} ${label}`;
      if (!new RegExp(`\\b${target}\\b`).test(blob) || /\.(?:jpg|png|webp|zip|ics|mp4)$/i.test(url.pathname)) return;
      if (/result|ergebnis|výsled|vysled|foto|photo|galer|archiv/i.test(blob)) return;
      url.hash = ""; follow.push({ url: url.href, score: label.includes(String(target)) ? 2 : 1 });
    });
    const structuredEvents = extractJsonLdEvents(response.finalUrl ?? job.url, response.html).filter(e => e.startDate.startsWith(`${target}-`));
    $("script,style,noscript,svg,footer,nav,aside").remove();
    $("br,p,div,section,article,h1,h2,h3,tr,li").each((_, el) => { $(el).append("\n"); });
    const clean = (raw: string) => raw.replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    // Some themes keep the whole race inside an aside or footer: then the stripped page is not the page.
    const full = cheerio.load(response.html); full("script,style,noscript,svg").remove(); full("br,p,div,section,article,h1,h2,h3,tr,li").each((_, el) => { full(el).append("\n"); });
    const stripped = clean($("body").text()), whole = clean(full("body").text());
    const text = stripped.replace(/\s+/g, " ").length < 300 && whole.length >= 800 ? whole : stripped;
    const flat = text.replace(/\s+/g, " ");
    const textFile = `pages/${keyOf(job.url)}.txt`;
    writeFileSync(join(directory, textFile), `${response.finalUrl ?? job.url}\n${title}\n\n${text}`);
    return { ...base, status: response.status, finalUrl: response.finalUrl, title, textLength: flat.length, textFile,
      snippets: yearSnippets(flat), dateSignals: dateSignals(flat), structuredEvents, asksVerification: asksForVerification(flat),
      // Seen through a browser, a short page simply is short. It has been read; only a page asking to verify the visitor has not.
      rendered: viaBrowser, needsBrowser: asksForVerification(flat) || (viaBrowser ? flat.length < 40 : wantsScript(flat)),
      follow: [...new Set(follow.sort((a, b) => b.score - a.score).map(x => x.url))].slice(0, 3) };
  } catch (error) { return { ...base, error: error instanceof Error ? error.message : String(error) }; }
}

let old: Race[] = []; let existing: Race[] = []; const startedAt = new Date().toISOString();
function save() {
  const all = [...pages.values()];
  const linked = old.filter(r => r.website_url && canonical(r.website_url));
  const candidates = all.filter(hasDate).map(p => ({ ...p, via: jobs.get(p.url)?.via ?? p.via, textFile: reportTextPath(p.textFile) }));
  const unresolved = all.filter(unreadable).map(p => ({ ...p, textFile: reportTextPath(p.textFile) }));
  // The saved reading says when it next has work, so a cycle need not start it to find out.
  const unread = [...jobs.values()].filter(job => !pages.has(job.url)).length;
  const nextDueAt = !replay && !unread && all.length ? new Date(Math.min(...all.map(rereadAt))).toISOString() : null;
  const coverage = { at: new Date().toISOString(), startedAt, year, target, unreadPages: unread, nextDueAt, mode: replay ? "offline replay of archived results; no database or website requests" : "read-only; literal signals are leads, not confirmed event dates", totalRaces: old.length, racesWithWebsite: old.filter(r => r.website_url).length, racesWithValidWebsite: linked.length,
    originalWebsites: new Set(linked.map(r => canonical(r.website_url!))).size,
    originalWebsitesAttempted: [...new Set(linked.map(r => canonical(r.website_url!)))].filter(u => u && pages.has(u) && pages.get(u)?.requestAttempted !== false).length,
    queuedPages: jobs.size, processedPages: all.length, archivedOutsidePlan: all.filter(p => !jobs.has(p.url)).length, attemptedPages: all.filter(p => p.requestAttempted !== false).length, deferredPages: all.filter(p => p.requestAttempted === false).length, successfulPages: all.filter(p => !unreadable(p)).length,
    candidatePages: candidates.length, unresolvedPages: unresolved.length, complete: [...jobs.keys()].every(url => pages.has(url)), allRequestsAttempted: [...jobs.keys()].every(url => pages.has(url) && pages.get(url)?.requestAttempted !== false),
    limitations: [`Source websites come from public, unmerged ${year} catalogue races.`, "HTML/PDF text and JSON-LD are checked; image-only and browser-only dates need manual review.", "At most three explicit next-year links per original URL plus a year-neutral homepage are followed; this is not an exhaustive site crawl.", "No full date detected does not prove that no announcement exists.", "No AI calls or catalogue writes."] };
  writeFileSync(join(directory, "coverage.json"), JSON.stringify(coverage, null, 2));
  writeFileSync(join(directory, "candidates.json"), JSON.stringify(candidates, null, 2));
  writeFileSync(join(directory, "unresolved.json"), JSON.stringify(unresolved, null, 2));
  return coverage;
}
function saveRaceReview() {
  const oldById = new Map(old.map(r => [r.id, r]));
  const existingByKey = new Map<string, Race[]>();
  for (const race of existing) {
    const key = `${race.location?.country_code ?? ""}:${editionKey(race.name)}`;
    existingByKey.set(key, [...existingByKey.get(key) ?? [], race]);
  }
  const related = new Map<string, Page[]>();
  for (const page of pages.values()) {
    const pending = [page.url]; const visited = new Set<string>(); const ids = new Set<string>();
    while (pending.length) {
      const ref = pending.pop()!; if (visited.has(ref)) continue; visited.add(ref);
      if (oldById.has(ref)) { ids.add(ref); continue; }
      pending.push(...(jobs.get(ref)?.via ?? pages.get(ref)?.via ?? []));
    }
    for (const id of ids) related.set(id, [...related.get(id) ?? [], page]);
  }
  const review = old.map(race => {
    const checked = related.get(race.id) ?? [];
    const candidates = checked.filter(hasDate);
    const key = editionKey(race.name);
    const known = key.length >= 5 ? existingByKey.get(`${race.location?.country_code ?? ""}:${key}`) ?? [] : [];
    const unresolved = checked.filter(unreadable);
    const status = !race.website_url ? "no_website" : !canonical(race.website_url) ? "invalid_website" : isPlatformOnly(race.website_url) ? "platform_page_only" : !checked.length ? "not_checked" : candidates.length ? `page_has_${target}_dates_needs_identity_review` : unresolved.length === checked.length ? "unreadable" : checked.some(p => !unreadable(p) && p.snippets?.length) ? "year_mentioned_without_full_date" : "no_date_signal_detected";
    return { ...race, reviewStatus: status, existingNameMatches: known, nameMatchIsHeuristic: true, checkedUrls: checked.map(p => p.url), unresolvedUrls: unresolved.map(p => p.url), candidatePages: candidates.map(p => ({ url: p.url, title: p.title, dates: p.dateSignals, structuredEvents: p.structuredEvents, snippets: p.snippets, needsBrowser: p.needsBrowser, textFile: reportTextPath(p.textFile) })) };
  });
  writeFileSync(join(directory, "race-review.json"), JSON.stringify(review, null, 2));
  writeFileSync(join(directory, "jobs.json"), JSON.stringify([...jobs.values()], null, 2));
  const csvCell = (cell: string) => {
    const safe = /^[=+\-@\t\r]/.test(cell) ? "'" + cell : cell;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  writeFileSync(join(directory, "race-review.csv"), "\uFEFF" + [[`race_${year}`, "country", "website", "review_status", `existing_${target}_name_matches`, "pages_with_dates", "unresolved_pages"], ...review.map(r => [r.name, r.location?.country_code ?? "", r.website_url ?? "", r.reviewStatus, r.existingNameMatches.map(e => `${e.name}: ${e.start_date}`).join(" | "), r.candidatePages.map(p => `${p.url}: ${p.dates?.join("; ")}`).join(" | "), r.unresolvedUrls.join(" | ")])].map(row => row.map(csvCell).join(",")).join("\n"));
}
async function main() {
  if (replay) {
    ({ old, existing } = replay);
  } else {
    old = (await readRaces(`${year}-01-01`, `${target}-01-01`)).filter(race => (!country || race.location?.country_code === country) && (!countries || countries.includes(race.location?.country_code ?? "")));
    existing = (await readRaces(`${target}-01-01`, `${target + 1}-01-01`)).filter(race => !countries || countries.includes(race.location?.country_code ?? ""));
    writeFileSync(join(directory, "races.json"), JSON.stringify({ year, target, old, existing }, null, 2));
  }
  for (const race of old) if (race.website_url) enqueue(race.website_url, race.id, `${year} race website`);
  const originals = [...jobs.values()];
  // A dated detail page often remains an archive; also inspect the organiser's root.
  const platforms = /(?:raceresult|bikeboard|pzkol|rideandrest|odjazd|kalendarzrowerowy|mtbs|sportsoft|sientries|worldracecalendar|urbanrace)\./;
  for (const job of originals) {
    const u = new URL(job.url);
    if (u.pathname !== "/" && !platforms.test(u.hostname) && !isDumpListingUrl(job.url) && !isRegistrationPlatformUrl(job.url)) enqueue(u.origin + "/", job.url, "organiser homepage alongside detail URL");
  }
  for (const page of pages.values()) if (jobs.has(page.url) && jobs.get(page.url)?.purpose !== "next-year link") for (const url of page.follow ?? []) enqueue(url, page.url, "next-year link");
  // Re-analyse saved text on resume when signal recognition is improved.
  for (const page of pages.values()) if (page.textFile && existsSync(join(archive, page.textFile))) {
    const text = readFileSync(join(archive, page.textFile), "utf8").split("\n").slice(1).join(" ").replace(/\s+/g, " ");
    page.dateSignals = dateSignals(text); page.snippets = yearSnippets(text);
  }
  if (replay) {
    console.log(JSON.stringify(save()));
    saveRaceReview();
    return;
  }
  console.log(JSON.stringify(save()));
  const timer = setInterval(() => console.log(JSON.stringify(save())), 30_000);
  try {
    async function worker() {
      for (;;) {
        if(stopping || Date.now()>=deadline || requestsThisPass>=limit)return;
        const now = Date.now();
        const job = [...jobs.values()].find(j => {
          const host = hostnameOf(j.url); const interval = /raceresult/.test(host) ? 1500 : 500;
          return !attempted.has(j.url) && (activeHosts.get(host) ?? 0) < 1 && (pausedHosts.has(host) || now - (hostStarts.get(host) ?? 0) >= interval);
        });
        if (!job) { if ([...jobs.keys()].every(url => attempted.has(url))) return; await sleep(100); continue; }
        attempted.add(job.url); requestsThisPass++; const host = hostnameOf(job.url);
        activeHosts.set(host, (activeHosts.get(host) ?? 0) + 1); hostStarts.set(host, Date.now());
        try {
          appendFileSync(ledger, JSON.stringify({ ...job, at: new Date().toISOString(), error: READING }) + "\n");
          // The request has its own limit, but parsing and redirects do not. One page must not hold the pass.
          let watchdog: NodeJS.Timeout | undefined;
          const page = await Promise.race([inspect(job).then(first => first.needsBrowser && !first.error && !browserOff && !first.asksVerification && browserReads++ < BROWSER_READS_PER_PASS ? inspect(job, true) : first), new Promise<Page>(resolve => { watchdog = setTimeout(() => resolve({ ...job, at: new Date().toISOString(), error: "read_timeout: the page did not finish within 90 s" }), 90_000); })]);
          clearTimeout(watchdog);
          pages.set(job.url, page); appendFileSync(ledger, JSON.stringify(page) + "\n");
          if (isFailure(page)) failures.set(job.url, (failures.get(job.url) ?? 0) + 1); else failures.delete(job.url);
          if (page.status === 429) {
            const streak = (rateLimitStreaks.get(host) ?? 0) + 1; rateLimitStreaks.set(host, streak);
            if (streak >= 3) pausedHosts.add(host);
            else hostStarts.set(host, Date.now() + 60_000);
          } else if (page.requestAttempted !== false) rateLimitStreaks.delete(host);
          if (job.purpose !== "next-year link" && page.status === 200) for (const url of page.follow ?? []) enqueue(url, job.url, "next-year link");
        } finally { activeHosts.set(host, activeHosts.get(host)! - 1); }
      }
    }
    await Promise.all(Array.from({ length: 24 }, worker));
  } finally {
    clearInterval(timer);
    const coverage=save();console.log(JSON.stringify(coverage));saveRaceReview();
    // A bounded or stopped pass has saved its progress, not finished its queue.
    // Exit outright: a request stuck past its limit must not keep a finished pass alive.
    process.exit(!coverage.complete || stopping ? 2 : 0);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
