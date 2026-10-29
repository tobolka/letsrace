/** Archive-first review/apply with a fixed cohort, saved proposals and fresh source checks. */
import { config } from "dotenv";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { readOriginalCategories, auditOriginalCategories, hasCachedOriginalRejection, type OriginalCategory } from "../src/lib/catalog/original-categories";
import { editionDocs, candidateLines } from "../src/lib/catalog/dossier-classes";
import type { DossierDoc } from "../src/lib/catalog/dossier";
import { readDocument } from "../src/lib/catalog/regulation-ages";
import { HAIKU, llmSpent, LlmUnavailable } from "../src/lib/llm/anthropic";
import { textHash } from "../src/lib/catalog/facts";
config({ path: ".env.local", quiet: true });
process.env.LLM_LEDGER_PATH ??= resolve("tmp/llm-budget.json");
process.env.LLM_DAILY_BUDGET_USD ??= "0.50";
process.env.LLM_MONTHLY_BUDGET_USD ??= "5.00";
process.env.LLM_BUDGET_USD ??= "0.20";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const until = new Date(Date.parse(`${today}T12:00:00Z`) + 365 * 864e5).toISOString().slice(0, 10);
const soon = new Date(Date.parse(`${today}T12:00:00Z`) + 90 * 864e5).toISOString().slice(0, 10);
const VERSION = "original-categories-v2";
const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
type CategoryRow = { id: string; event_id: string; name: string; age_min: number | null; age_max: number | null; distance_km: number | null; elevation_m: number | null; gender: string | null; audience: string | null };
type Event = { id: string; name: string; start_date: string; age_categories: string[] | null; age_confidence: string | null; regulations_url: string | null; registration_url: string | null; website_url: string | null; series_id: string | null; location: { municipality: string | null; country_code: string | null } | null; overrides: { locked_fields: string[] | null } | null; categories: CategoryRow[] };
type Proposal = { event: Event; categories: OriginalCategory[]; complete: boolean; hashes: Record<string, string>; usage: unknown; audit?: { keep: boolean; why: string; usage: unknown } };
type Plan = { version: string; createdAt: string; baseline: Event[]; queue: unknown[]; proposals: Proposal[]; rejected: unknown[]; costUsd: number; stopped: boolean };
async function loadEvents() {
  const s = createServerSupabase();
  const rows: Event[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from("events").select("id,name,start_date,age_categories,age_confidence,regulations_url,registration_url,website_url,series_id,location:locations(municipality,country_code),overrides:event_overrides(locked_fields),categories:event_categories(*)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "tbc", "confirmed"])
      .gte("start_date", today).lte("start_date", until).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data as unknown as Event[]);
    if (!data || data.length < 1000) return rows;
  }
}
async function main() {
  mkdirSync("tmp/import-validation", { recursive: true });
  const rows = await loadEvents();
  const auditPath = arg("audit-plan", "");
  if (auditPath) {
    const plan = JSON.parse(readFileSync(auditPath, "utf8")) as Plan;
    const limit = Number(arg("max", "30"));
    for (const proposal of plan.proposals.slice(0, limit)) {
      if (proposal.audit) continue;
      const archive = JSON.parse(readFileSync(resolve(arg("dossier-dir", "tmp/source-dossiers"), `${proposal.event.id}.json`), "utf8")) as { documents: DossierDoc[] };
      try {
        proposal.audit = await auditOriginalCategories({ name: proposal.event.name, startDate: proposal.event.start_date }, proposal.categories, archive.documents);
        console.log(`${proposal.audit.keep ? "PASS" : "REJECT"} ${proposal.event.name}: ${proposal.audit.why}`);
      } catch (error) { if (error instanceof LlmUnavailable) break; throw error; }
      finally { writeFileSync(auditPath, JSON.stringify(plan, null, 2)); }
    }
    const summary = { proposals: plan.proposals.length, accepted: plan.proposals.filter(p => p.audit?.keep).length, rejected: plan.proposals.filter(p => p.audit?.keep === false).length, pending: plan.proposals.filter(p => !p.audit).length, auditCostUsd: llmSpent() };
    writeFileSync(auditPath.replace(/\.json$/, "-audit.json"), JSON.stringify(summary, null, 2));
    console.log(summary); return;
  }
  const applyPath = arg("apply-plan", "");
  if (applyPath) {
    const plan = JSON.parse(readFileSync(applyPath, "utf8")) as Plan;
    if (plan.version !== VERSION) throw new Error("Wrong plan version");
    const s = createServerSupabase();
    const refreshed = new Map<string, Awaited<ReturnType<typeof readDocument>>>();
    const result = { proposals: plan.proposals.length, events: 0, categories: 0, stale: 0, locked: 0, failed: 0, verifiedAfterWrite: 0 };
    const written = [];
    for (const proposal of plan.proposals) {
      if (proposal.audit?.keep !== true) continue;
      const now = rows.find(r => r.id === proposal.event.id);
      if (!now || now.name !== proposal.event.name || now.start_date !== proposal.event.start_date || now.categories.length) { result.stale++; continue; }
      if (now.overrides?.locked_fields?.some(f => ["categories", "event_categories", "age_categories", "age_confidence", "audience"].includes(f))) { result.locked++; continue; }
      let valid = true;
      for (const url of Object.keys(proposal.hashes)) {
        if (!refreshed.has(url)) refreshed.set(url, await readDocument(url).catch(() => null));
        const doc = refreshed.get(url);
        if (!doc || textHash(normalize(doc.text)) !== proposal.hashes[url]) valid = false;
      }
      if (!valid) { result.stale++; console.log(`STALE ${now.name}`); continue; }
      // Recheck category absence and human locks immediately before the additive write.
      const { data: current, error: checkError } = await s.from("events").select("name,start_date,categories:event_categories(id),overrides:event_overrides(locked_fields)").eq("id", now.id).eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "tbc", "confirmed"]).single();
      if (checkError || !current || current.name !== now.name || current.start_date !== now.start_date || current.categories.length || (current.overrides as unknown as { locked_fields: string[] | null } | null)?.locked_fields?.some((f: string) => ["categories", "event_categories", "age_categories", "age_confidence", "audience"].includes(f))) { result.stale++; continue; }
      const { data: inserted, error } = await s.from("event_categories").insert(proposal.categories.map(c => ({ event_id: now.id, name: c.name, age_min: c.ageMin, age_max: c.ageMax, gender: c.gender }))).select("*");
      if (error || !inserted?.length) { result.failed++; console.error(error); continue; }
      const { error: factError } = await s.from("event_facts").insert({ event_id: now.id, field: "event_categories", value: { rows: inserted, details: proposal.categories, complete: proposal.complete }, previous: [],
        source_url: proposal.categories[0]!.sourceUrl, quote: proposal.categories.map(c => c.quote).join("\n"), method: "source_categories", model: HAIKU, version: VERSION });
      if (factError) {
        const { error: cleanup } = await s.from("event_categories").delete().in("id", inserted.map(c => c.id));
        if (cleanup) throw new Error(`Evidence failure and cleanup failure: ${factError.message}; ${cleanup.message}`);
        result.failed++; continue;
      }
      const { data: saved, error: readError } = await s.from("event_categories").select("id,name,age_min,age_max,gender").eq("event_id", now.id);
      if (readError || !inserted.every(c => saved?.some(r => r.id === c.id && r.name === c.name && r.age_min === c.age_min && r.age_max === c.age_max && r.gender === c.gender))) throw new Error(`Post-write verification failed: ${now.id}`);
      result.events++; result.categories += inserted.length; result.verifiedAfterWrite++;
      written.push({ id: now.id, name: now.name, categories: proposal.categories, insertedIds: inserted.map(c => c.id) });
      console.log(`VERIFIED ${now.name}: ${inserted.length} original classes`);
      writeFileSync(applyPath.replace(/\.json$/, "-applied.json"), JSON.stringify({ result, written }, null, 2));
    }
    const after = await loadEvents();
    const original = new Map(plan.baseline.map(r => [r.id, r]));
    const cohort = after.filter(r => original.has(r.id));
    const metrics = { matchedEvents: cohort.length, addedOriginalCategoryEvents: cohort.filter(r => !original.get(r.id)!.categories.length && r.categories.length).length,
      changedNormalizedCategories: cohort.filter(r => JSON.stringify(r.age_categories) !== JSON.stringify(original.get(r.id)!.age_categories) || r.age_confidence !== original.get(r.id)!.age_confidence).length,
      addedRegulations: cohort.filter(r => !original.get(r.id)!.regulations_url && r.regulations_url).length,
      addedRegistration: cohort.filter(r => !original.get(r.id)!.registration_url && r.registration_url).length };
    writeFileSync(applyPath.replace(/\.json$/, "-applied.json"), JSON.stringify({ result, metrics, written }, null, 2));
    console.log({ result, metrics });
    return;
  }
  const dir = arg("dossier-dir", "tmp/source-dossiers");
  const max = Number(arg("max", "30"));
  if (!Number.isInteger(max) || max < 1) throw new Error("--max must be a positive integer");
  const ids = arg("ids", "").split(",").filter(Boolean);
  const archives = new Map<string, { collectedAt: string; race: { id: string; name: string; start_date: string }; documents: DossierDoc[] }>();
  for (const file of readdirSync(dir).filter(f => /^[0-9a-f-]{36}\.json$/.test(f))) {
    const d = JSON.parse(readFileSync(resolve(dir, file), "utf8"));
    if (d.race && Array.isArray(d.documents)) archives.set(d.race.id, d);
  }
  const queue = rows.filter(r => (!ids.length || ids.includes(r.id)) && !r.categories.length && !r.overrides?.locked_fields?.some(f => ["categories", "event_categories", "age_categories", "age_confidence", "audience"].includes(f)))
    .map(event => { const archive = archives.get(event.id); const valid = archive?.race.name === event.name && archive.race.start_date === event.start_date;
      const docs = valid ? archive.documents : []; const eligible = editionDocs(docs, event.start_date, [event.name, event.location?.municipality ?? ""]);
      const lines = candidateLines(eligible, 300); const bytes = Buffer.byteLength(eligible.map(d => d.text).join("\n"), "utf8");
      const score = (event.age_confidence !== "explicit" ? 20 : 0) + Math.min(lines.length, 30) + (event.start_date <= soon ? 15 : 0) + (eligible.some(d => d.kind === "regulations") ? 10 : 0);
      return { event, docs, eligible: eligible.length, lines: lines.length, bytes, score }; })
    .filter(q => q.eligible > 0 && q.lines > 0 && q.bytes < 85_000 && !hasCachedOriginalRejection({ name: q.event.name, startDate: q.event.start_date, place: q.event.location?.municipality }, q.docs)).sort((a, b) => b.score - a.score || a.event.start_date.localeCompare(b.event.start_date));
  const plan: Plan = { version: VERSION, createdAt: new Date().toISOString(), baseline: rows, queue: queue.map(q => ({ id: q.event.id, name: q.event.name, country: q.event.location?.country_code, score: q.score, documents: q.eligible, lines: q.lines })), proposals: [], rejected: [], costUsd: 0, stopped: false };
  const path = arg("out", "tmp/import-validation/category-plan.json");
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(plan, null, 2));
  if (!process.argv.includes("--queue-only")) for (const q of queue.slice(0, max)) {
    try {
      const got = await readOriginalCategories({ name: q.event.name, startDate: q.event.start_date, place: q.event.location?.municipality }, q.docs);
      if (got.categories.length) {
        const urls = new Set(got.categories.map(c => c.sourceUrl));
        const hashes = Object.fromEntries(q.docs.filter(d => urls.has(d.url)).map(d => [d.url, textHash(normalize(d.text))]));
        plan.proposals.push({ event: q.event, categories: got.categories, complete: got.complete, hashes, usage: got.usage });
        console.log(`DRY ${q.event.name}: ${got.categories.length} original classes, complete=${got.complete}`);
      } else { plan.rejected.push({ id: q.event.id, name: q.event.name, verdict: got.verdict, usage: got.usage }); console.log(`REJECT ${q.event.name}`); }
    } catch (error) {
      if (error instanceof LlmUnavailable) { plan.stopped = true; break; }
      plan.rejected.push({ id: q.event.id, name: q.event.name, error: String(error) });
    } finally { plan.costUsd = llmSpent(); writeFileSync(path, JSON.stringify(plan, null, 2)); }
  }
  console.log({ baseline: rows.length, queued: queue.length, attempted: plan.proposals.length + plan.rejected.length, proposals: plan.proposals.length, sourceClasses: plan.proposals.reduce((n, p) => n + p.categories.length, 0), rejected: plan.rejected.length, costUsd: plan.costUsd, stopped: plan.stopped, plan: path });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
