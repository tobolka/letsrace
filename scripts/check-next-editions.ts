/**
 * Weekly check of next-season editions for one country.
 * Dry run by default; --apply publishes only announcements that pass the shared evidence gates.
 *
 * node scripts/with-node.cjs tsx scripts/check-next-editions.ts --country=CZ [--apply] [--max-ai=60] [--skip-read]
 *
 * On the Mac, inside scripts/local-run.sh, the same gates judge what the regular reading
 * already saved. No page is read for the assessment, no model is asked and only the local
 * copy is written; sending what passed is a separate, reviewed step.
 *   ... check-next-editions.ts --archive=DIR --countries=CZ,SK,DE --literal --apply [--max-apply=30] [--seconds=240] [--max-ai=40]
 * With --max-ai the pages plain reading cannot settle go to the model, under the shared budget;
 * that also needs LOCAL_ALLOW_AI=1, and the shared gates then judge its answer the same way.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
import { load } from "cheerio";
import { defaultEditionSeason } from "../src/lib/catalog/edition-season";

type Page = { url: string; title?: string; dates?: string[]; textFile?: string };
type Review = { id: string; name: string; start_date: string; website_url: string | null; reviewStatus: string; candidatePages?: Page[] };
type Row = { race: string; name: string; state: string; reason?: string; url?: string; date?: string; eventId?: string };

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const country = (arg("country") ?? "CZ").toUpperCase();
const shared = arg("archive");
const countries = arg("countries")?.toUpperCase().split(",");
const literal = process.argv.includes("--literal");
const maxApply = Number(arg("max-apply") ?? 100000), seconds = Number(arg("seconds") ?? 3600);
const deadline = Date.now() + seconds * 1000;
const apply = process.argv.includes("--apply");
const maxAiGiven = arg("max-ai") !== undefined;
/** Announcements someone read and settled: { "<race id>": { url, startDate, endDate?, quote } }. */
const answersFile = arg("answers");
const maxAi = Number(arg("max-ai") ?? 300);
const season = Number(arg("season") ?? defaultEditionSeason()), target = season + 1;
/** Dry-run recall test: behave as if these existing editions were missing. */
const ignored = new Set((arg("ignore-event") ?? "").split(",").filter(Boolean));
if (apply && ignored.size) throw Error("--ignore-event is for dry runs only");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
/** The visible text with blocks on their own lines, the way the organiser reading saves a page. */
function readerText(html: string) {
  const $ = load(html);
  $("script,style,noscript,template,[hidden],[aria-hidden=true]").remove();
  $("br,p,div,section,article,h1,h2,h3,h4,h5,h6,tr,td,th,li,dt,dd").append("\n");
  return $("body").text().replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n");
}

async function main() {
  if (!/^[A-Z]{2}$/.test(country) || !Number.isInteger(maxAi) || maxAi < 0 || !Number.isInteger(season) || season < 2020 || season > 2100) throw Error("Invalid country, season or AI limit");
  if (countries?.some(code => !/^[A-Z]{2}$/.test(code)) || !Number.isInteger(maxApply) || maxApply < 0 || !(seconds > 0)) throw Error("Invalid countries or limits");
  if (shared && (!countries || !literal)) throw Error("A saved reading is assessed for --countries with --literal");
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const [{ createServerSupabase }, { askJson, llmSpent, LlmUnavailable, HAIKU }, next, identity, { saveCandidate, candidateAssertion }, { validateReviewSource }, { ingestReviewedCandidate }, { fetchPage }, { pageAsText }, { catalogueWindow }, { sendOpsAlert }, { literalEditionAnswer, modelCanSettle, modelAnswerPlausible }] = await Promise.all([
    import("../src/lib/supabase/server"), import("../src/lib/llm/anthropic"), import("../src/lib/catalog/next-edition"), import("../src/lib/catalog/edition-identity"),
    import("../src/lib/discovery/review"), import("../src/lib/discovery/review-source"), import("../src/lib/watcher/run"), import("../src/lib/watcher/http"),
    import("../src/lib/watcher/extractors/llm-calendar"), import("../src/lib/catalog/overview-quality"), import("../src/lib/ops/alerts"), import("../src/lib/catalog/next-edition-literal"),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());
  const archive = shared ?? `reports/next-edition-websites-${season}-to-${target}-${today}-${country.toLowerCase()}`;
  if (!shared && (!process.argv.includes("--skip-read") || !existsSync(join(archive, "race-review.json")))) {
    const read = spawnSync(process.execPath, ["scripts/with-node.cjs", "tsx", "scripts/audit-next-edition-websites.ts", String(season), `--country=${country}`], { stdio: ["ignore", "ignore", "inherit"], timeout: 30 * 60_000 });
    if (read.status !== 0) throw Error(`Reading organiser websites failed (${read.status ?? read.signal})`);
  }
  // The saved reading's overview is rebuilt offline, so a pass stopped midway still counts.
  const reviews = JSON.parse(readFileSync(join(archive, shared ? "replay" : "", "race-review.json"), "utf8")) as Review[];
  const db = createServerSupabase();

  const readEvents = async (from: string, until: string) => {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("events").select("id,name,start_date,end_date,visibility,series_id,disciplines,event_type,website_url,location:locations(lat,lng,municipality,country_code)")
        .is("merged_into_id", null).gte("start_date", from).lt("start_date", until).order("id").range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };
  const previous = new Map((await readEvents(`${season}-01-01`, `${target}-01-01`)).map(row => [row.id, row]));
  const upcoming = (await readEvents(`${target}-01-01`, `${target + 1}-01-01`)).filter(row => !ignored.has(row.id));
  const hostOf = (url: string | null) => { try { return new URL(url ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } };
  const racesPerHost = new Map<string, number>(), racesPerAddress = new Map<string, number>();
  for (const review of reviews) {
    racesPerHost.set(hostOf(review.website_url), (racesPerHost.get(hostOf(review.website_url)) ?? 0) + 1);
    if (review.website_url) racesPerAddress.set(review.website_url, (racesPerAddress.get(review.website_url) ?? 0) + 1);
  }
  /** A detail page only this race links to says which race it is about, even on a shared site. */
  const isOwnPage = (url: string, review: Review) => {
    try { return url === review.website_url && racesPerAddress.get(url) === 1 && new URL(url).pathname !== "/"; } catch { return false; }
  };
  const isShared = (url: string, review: Review) => (racesPerHost.get(hostOf(url)) ?? 0) >= 2 && !isOwnPage(url, review);

  mkdirSync("tmp/next-editions", { recursive: true });
  const cachePath = `tmp/next-editions/answers-${target}.json`;
  const cache = (existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {}) as Record<string, import("../src/lib/catalog/next-edition").EditionAnswer>;
  const files = readdirSync(join(archive, "pages"));
  const pageText = (url: string) => {
    const prefix = hash(url).slice(0, 20), file = files.find(name => name.startsWith(prefix));
    return file ? readFileSync(join(archive, "pages", file), "utf8") : "";
  };

  const reviewed = (answersFile ? JSON.parse(readFileSync(answersFile, "utf8")) : {}) as Record<string, { url: string; startDate: string; endDate?: string | null; quote: string }>;
  const rows: Row[] = [];
  const proposals: { row: Row; event: import("../src/lib/domain").ParsedEvent; answer: import("../src/lib/catalog/next-edition").EditionAnswer; candidate: import("../src/lib/catalog/next-edition").EditionRace; pageInput: import("../src/lib/catalog/next-edition").EditionPage; raceName: string; raceId: string; sharedHost: boolean; country: string; readerSettled: boolean }[] = [];
  let asked = 0, aiStopped = false;
  for (const review of reviews) {
    const race = previous.get(review.id);
    if (!race) continue;
    const raceCountry = shared ? race.location?.country_code ?? "" : country;
    if (countries && !countries.includes(raceCountry)) continue;
    const base = { race: review.id, name: review.name };
    const here = { id: race.id, name: race.name, start_date: race.start_date, series_id: race.series_id, disciplines: race.disciplines, location: race.location };
    const next_ = identity.findNextEdition(here, upcoming);
    if (next_) { rows.push({ ...base, state: next_.visibility === "public" ? "found" : "waiting", reason: next_.visibility === "public" ? undefined : "next_edition_is_hidden", eventId: next_.id, date: next_.start_date }); continue; }
    if (review.reviewStatus === "no_website") { rows.push({ ...base, state: "no_website" }); continue; }
    if (review.reviewStatus === "unreadable") { rows.push({ ...base, state: "unreadable" }); continue; }
    if (review.reviewStatus === "platform_page_only") { rows.push({ ...base, state: "platform_page_only" }); continue; }
    if (review.reviewStatus === "year_mentioned_without_full_date") { rows.push({ ...base, state: "year_only" }); continue; }
    const pages = (review.candidatePages ?? []).filter(page => hostOf(page.url) === hostOf(review.website_url)).slice(0, 3);
    if (!pages.length) { rows.push({ ...base, state: review.candidatePages?.length ? "waiting" : "not_announced", reason: review.candidatePages?.length ? "date_only_on_another_site" : undefined }); continue; }

    const candidate = { id: race.id, name: race.name, start_date: race.start_date, website_url: review.website_url, disciplines: race.disciplines, municipality: race.location?.municipality ?? null, country: raceCountry, lat: race.location?.lat, lng: race.location?.lng, event_type: race.event_type };
    let outcome: Row | null = null;
    for (const page of pages) {
      const text = pageText(page.url);
      if (!text) continue;
      const pageInput = { url: page.url, title: page.title, text };
      let sharedHost = isShared(page.url, review);
      const prompt = next.editionPrompt(candidate, pageInput, target);
      const key = hash(`${next.NEXT_EDITION_VERSION}:${race.id}:${prompt.user}`);
      let answer: import("../src/lib/catalog/next-edition").EditionAnswer | undefined;
      const settled = reviewed[review.id];
      if (settled && settled.url !== page.url) continue;
      if (settled) answer = { sameRace: true, cycling: true, announced: true, startDate: settled.startDate, endDate: settled.endDate ?? null, quote: settled.quote, newPlace: null };
      else if (literal) {
        // The saved file opens with its address and title, which are not page text.
        const read = literalEditionAnswer({ race: { ...candidate, end_date: race.end_date }, page: { ...pageInput, text: text.split("\n").slice(3).join("\n") }, year: target, ownPage: isOwnPage(page.url, review) });
        if (read.state === "answer") answer = read.answer;
        // What plain reading cannot settle goes to the model only when one was allowed for this pass.
        else if (!maxAiGiven || !modelCanSettle(read.reason)) { outcome ??= { ...base, state: read.reason === "literal_no_race_date_on_page" ? "not_announced" : "waiting", reason: read.reason, url: page.url }; continue; }
      }
      if (!answer && !cache[key]) {
        if (asked >= maxAi || aiStopped) { outcome = { ...base, state: "waiting", reason: "ai_limit", url: page.url }; break; }
        try {
          asked += 1;
          const reply = (await askJson<import("../src/lib/catalog/next-edition").EditionAnswer>({ ...prompt, model: HAIKU, maxTokens: 300 })).json;
          if (!reply) { outcome = { ...base, state: "waiting", reason: "ai_answer_unusable", url: page.url }; continue; }
          cache[key] = reply;
          writeFileSync(cachePath, JSON.stringify(cache));
        } catch (error) {
          if (!(error instanceof LlmUnavailable)) { outcome = { ...base, state: "waiting", reason: "ai_answer_unusable", url: page.url }; continue; }
          aiStopped = true;
          outcome = { ...base, state: "waiting", reason: "ai_budget", url: page.url };
          break;
        }
      }
      const fromModel = !answer;
      answer ??= cache[key]!;
      if (literal && fromModel && answer.announced === true && !modelAnswerPlausible(candidate, answer, target)) { outcome ??= { ...base, state: "waiting", reason: "model_date_not_plausible", url: page.url }; continue; }
      // A reader settled which race this is, which is what the shared-site check stands in for.
      if (settled) sharedHost = false;
      const decision = next.decideEdition({ race: candidate, page: pageInput, answer, year: target, today, sharedHost, readerSettled: Boolean(settled) });
      if (decision.state === "wait") { outcome ??= { ...base, state: decision.reason === "not_announced_on_page" ? "not_announced" : "waiting", reason: decision.reason, url: page.url }; continue; }
      const existing = next.matchAnnouncedEdition(decision.event, upcoming);
      if (existing.state === "ambiguous") { outcome = { ...base, state: "waiting", reason: "next_edition_identity_ambiguous", url: page.url, date: decision.event.startDate }; break; }
      if (existing.state === "found") {
        const matched = existing.event;
        outcome = { ...base, state: matched.visibility === "public" ? "found" : "waiting", reason: matched.visibility === "public" ? "matched_announcement_identity" : "next_edition_is_hidden", url: page.url, date: decision.event.startDate, eventId: matched.id }; break;
      }
      outcome = { ...base, state: "waiting", reason: "would_publish", url: page.url, date: decision.event.startDate };
      proposals.push({ row: outcome, event: decision.event, answer, candidate, pageInput, raceName: race.name, raceId: race.id, sharedHost, country: raceCountry, readerSettled: Boolean(settled) });
      break;
    }
    rows.push(outcome ?? { ...base, state: "not_announced" });
  }

  // Two races must not claim one announcement; the identity is then not settled.
  const claims = new Map<string, number>();
  for (const { event } of proposals) claims.set(`${event.sourceUrl}|${event.startDate}`, (claims.get(`${event.sourceUrl}|${event.startDate}`) ?? 0) + 1);
  let attempted = 0;
  for (const proposal of proposals) {
    const { row: outcome, event, answer, candidate, pageInput, raceName, raceId, sharedHost, country: raceCountry, readerSettled } = proposal;
    if (claims.get(`${event.sourceUrl}|${event.startDate}`)! > 1) { outcome.reason = "several_races_claim_page"; continue; }
    // Bounded per pass; what is left stays proposed and the next pass continues.
    if (attempted >= maxApply || Date.now() >= deadline) { outcome.reason = "pass_limit"; continue; }
    attempted += 1;
    const url = pageInput.url;
    if (!apply) {
      try {
        const source = await fetchPage(url, { fresh: true });
        const fresh = pageAsText(source.html, url).text;
        const assertion = candidateAssertion(event, { sourceUrl: url, documentHash: hash(source.html), textHash: hash(fresh), reason: "dry run", country: raceCountry });
        const row = { ...assertion, id: randomUUID(), status: "pending" } as unknown as import("../src/lib/discovery/review").ReviewRow;
        await validateReviewSource(row, { id: row.id, evidenceHash: row.evidence_hash, action: "publish", reason: "dry run", expectedEventId: null, authority: "official", checked: { identity: true, date: true, place: true, discipline: true, authority: true } }, catalogueWindow().from);
      } catch (error) {
        outcome.reason = `gate_failed: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}`;
      }
      continue;
    }
    try {
      const source = await fetchPage(url, { fresh: true });
      const fresh = pageAsText(source.html, url).text;
      // A quote from a saved reading is checked against the same text that reading saw.
      const stillThere = literal || readerSettled ? `${fresh}\n${readerText(source.html)}` : fresh;
      if (source.status !== 200 || next.decideEdition({ race: candidate, page: { ...pageInput, text: stillThere }, answer, year: target, today, sharedHost, readerSettled }).state !== "publish") throw Error("Announcement is no longer on the page");
      const saved = await saveCandidate(db, event, { sourceUrl: url, documentHash: hash(source.html), textHash: hash(fresh), reason: `Announced ${target} edition of ${raceName}`, country: raceCountry });
      if (saved.rejected) throw Error("Candidate was already rejected");
      const { data: row, error } = await db.from("pipeline_candidates").select("*").eq("candidate_key", saved.candidate_key).eq("evidence_hash", saved.evidence_hash).single();
      if (error) throw error;
      const review_ = { id: row.id, evidenceHash: row.evidence_hash, action: "publish" as const, reason: `Own website states the ${target} date; previous edition ${raceId}.`, expectedEventId: null, authority: "official" as const, checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
      await validateReviewSource(row, review_, catalogueWindow().from);
      const { data: claim, error: claimError } = await db.rpc("pipeline_claim_candidate", { p_id: row.id, p_hash: row.evidence_hash, p_updated: row.updated_at, p_decision: review_ as never, p_retry_resolved: false });
      if (claimError) throw claimError;
      const receipt = claim as { status?: string; token?: string } | null;
      if (!receipt?.token || receipt.status !== "publishing") throw Error("Candidate claim was not confirmed");
      try {
        const result = await ingestReviewedCandidate(row, review_, { id: row.id, evidenceHash: row.evidence_hash, token: receipt.token });
        Object.assign(outcome, { state: "published", reason: undefined, eventId: result.id });
      } catch (error) {
        const retry = await db.rpc("pipeline_retry_candidate", { p_id: row.id, p_token: receipt.token, p_error: error instanceof Error ? error.message : "Publication interrupted" });
        if (retry.error) throw retry.error;
        throw error;
      }
    } catch (error) {
      outcome.reason = `publish_failed: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}`;
    }
  }

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.state] = (counts[row.state] ?? 0) + 1;
  const reasons: Record<string, number> = {};
  for (const row of rows) if (row.state === "waiting" && row.reason) reasons[row.reason.split(":")[0]!] = (reasons[row.reason.split(":")[0]!] ?? 0) + 1;
  const summary = { status: aiStopped || rows.some(row => row.reason === "pass_limit" || row.reason === "ai_limit") ? "deferred" : "ok", country: shared ? countries!.join(",") : country, season: target, mode: apply ? "apply" : "dry-run", races: rows.length, counts, waiting: reasons, askedAi: asked, aiUsd: Number(llmSpent().toFixed(4)), at: new Date().toISOString() };
  writeFileSync(join(archive, "edition-status.json"), JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`organiser_assessment ${JSON.stringify(summary)}`);
  for (const row of rows.filter(row => row.state === "published" || row.reason === "would_publish")) console.log(`${row.state === "published" ? "published" : "would publish"}: ${row.name} -> ${row.date} ${row.url}`);
  for (const row of rows.filter(row => row.state === "waiting" && row.reason !== "would_publish" && row.reason !== "next_edition_is_hidden")) console.log(`waiting: ${row.name} | ${row.reason} | ${row.date ?? ""} ${row.url ?? ""}`);
  if (apply) {
    const now = new Date().toISOString();
    const { error } = await db.from("pipeline_jobs").upsert({ key: `next-editions-${shared ? "all" : country.toLowerCase()}`, run_id: randomUUID(), status: summary.status, started_at: now, finished_at: now, summary });
    if (error) throw error;
    // A local pass reports through its own result and may not reach out from here.
    if (process.env.LETSRACE_LOCAL_PASS !== "1") await sendOpsAlert({ title: `Ročníky ${target} (${country}): nově ${counts.published ?? 0}, čeká ${counts.waiting ?? 0}`, body: `Nalezeno ${counts.found ?? 0}, zatím neoznámeno ${(counts.not_announced ?? 0) + (counts.year_only ?? 0)}, nečitelné ${counts.unreadable ?? 0}, bez webu ${counts.no_website ?? 0}.`, meta: { aiUsd: summary.aiUsd } });
  }
  if (aiStopped) process.exitCode = 2;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
