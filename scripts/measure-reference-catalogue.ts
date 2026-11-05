/** Read-only comparison with explicitly reviewed identities; name similarity is never identity. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { nameSimilarity } from "../src/lib/discovery/report";

type Row = { id: string; name: string; start_date: string; end_date: string | null; visibility: string; merged_into_id: string | null; disciplines: string[]; level: string; uci_class: string | null;
  location: { name: string; municipality: string | null; country_code: string } | null; sources: { external_id: string; source_url: string }[] };
type Case = { id: string; name: string; sourceUrl: string; sourceUrlScope?: "event" | "calendar"; expected: { start_date: string; end_date: string; country: string; placeContains?: string; disciplines: string[]; level?: string; uci_class?: string }; reviewedEventIds: string[]; sourceExternalIds: string[]; nameAliases: string[] };
type SeparationCheck = { id: string; caseIds: string[]; expected: "separate"; sourceUrl: string };
type EvidenceLimit = { id: string; sourceUrl: string; expected: string };
type Reference = { version: number; referenceDate: string; cases: Case[]; separationChecks?: SeparationCheck[]; evidenceLimits?: EvidenceLimit[] };

function validDay(day: string) {
  const value = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === day;
}

function validateReference(reference: Reference) {
  if (reference.version !== 1 || !validDay(reference.referenceDate) || !reference.cases.length) throw Error("Invalid reference set");
  const checks = reference.separationChecks ?? [], limits = reference.evidenceLimits ?? [];
  const ids = [...reference.cases, ...checks, ...limits].map(entry => entry.id);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw Error("Invalid or duplicate reference IDs");
  for (const entry of [...reference.cases, ...checks, ...limits]) {
    if (new URL(entry.sourceUrl).protocol !== "https:") throw Error(`Expected an HTTPS source for ${entry.id}`);
  }
  for (const { id, expected } of reference.cases) {
    if (!validDay(expected.start_date) || !validDay(expected.end_date) || expected.start_date > expected.end_date || !/^[A-Z]{2}$/.test(expected.country)) {
      throw Error(`Invalid date or country for ${id}`);
    }
  }
  const casesByUrl = Map.groupBy(reference.cases, c => c.sourceUrl);
  for (const [url, cases] of casesByUrl) {
    if (cases.length > 1 && cases.some(c => c.sourceUrlScope !== "calendar")) throw Error(`Shared source must be labelled as a calendar: ${url}`);
  }
  const caseIds = new Set(reference.cases.map(c => c.id));
  for (const check of checks) {
    if (check.expected !== "separate" || check.caseIds.length < 2 || new Set(check.caseIds).size !== check.caseIds.length || check.caseIds.some(id => !caseIds.has(id))) {
      throw Error(`Invalid separation check ${check.id}`);
    }
  }
  if (limits.some(limit => !limit.expected.trim())) throw Error("Missing expected result for an evidence limit");
}

async function main() {
  const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const input = arg("reference") ?? "docs/quality/reference-2026-11-03.json";
  const raw = await readFile(input, "utf8"), reference = JSON.parse(raw) as Reference;
  validateReference(reference);
  const referenceHash = createHash("sha256").update(raw).digest("hex");
  if (process.argv.includes("--validate-only")) {
    console.log(JSON.stringify({ referenceHash, cases: reference.cases.length, countries: [...new Set(reference.cases.map(c => c.expected.country))].sort(),
      separationChecks: reference.separationChecks?.length ?? 0, evidenceLimits: reference.evidenceLimits?.length ?? 0 }));
    return;
  }
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const db = createServerSupabase(), catalog: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("events").select("id,name,start_date,end_date,visibility,merged_into_id,disciplines,level,uci_class,location:locations(name,municipality,country_code),sources:event_sources(external_id,source_url)")
      .gte("start_date", "2026-01-01").lte("start_date", "2027-12-31").order("id").range(offset, offset + 499);
    if (error) throw error;
    catalog.push(...data as Row[]); if (data.length < 500) break;
  }
  const rows = reference.cases.map(c => {
    const matches = catalog.filter(e => c.reviewedEventIds.includes(e.id) || e.start_date.startsWith(c.expected.start_date.slice(0, 4)) &&
      e.sources.some(s => c.sourceExternalIds.includes(s.external_id) || c.sourceUrlScope !== "calendar" && s.source_url === c.sourceUrl));
    const publicMatches = matches.filter(e => e.visibility === "public" && !e.merged_into_id);
    // Multiple records for a weekend may be legitimate; report ambiguity instead of guessing a merge.
    const chosen = publicMatches.length === 1 ? publicMatches[0] : null;
    const checks: Record<string, boolean> = {};
    if (chosen) {
      checks.date = chosen.start_date === c.expected.start_date && (chosen.end_date ?? chosen.start_date) === c.expected.end_date;
      checks.country = chosen.location?.country_code === c.expected.country;
      if (c.expected.disciplines.length) checks.discipline = c.expected.disciplines.every(d => chosen.disciplines.includes(d));
      if (c.expected.placeContains) checks.place = `${chosen.location?.name ?? ""} ${chosen.location?.municipality ?? ""}`.toLocaleLowerCase().includes(c.expected.placeContains.toLocaleLowerCase());
      if (c.expected.level) checks.level = chosen.level === c.expected.level;
      if (c.expected.uci_class) checks.uciClass = chosen.uci_class?.toLowerCase() === c.expected.uci_class;
    }
    const suggestions = catalog.filter(e => c.nameAliases.some(a => e.name.toLocaleLowerCase().includes(a.toLocaleLowerCase())) || nameSimilarity(e.name, c.name) >= .7)
      .map(e => ({ id: e.id, name: e.name, startDate: e.start_date, visibility: e.visibility, mergedInto: e.merged_into_id }));
    return { caseId: c.id, name: c.name, sourceUrl: c.sourceUrl, state: !publicMatches.length ? "no_reviewed_public_match" : publicMatches.length > 1 ? "identity_review" : Object.values(checks).every(Boolean) ? "matches_reference" : "field_discrepancy", checks, matches, suggestions };
  });
  const report = { at: new Date().toISOString(), referenceDate: reference.referenceDate, referenceHash,
    scope: "Dated reference comparison. Separation checks and evidence limits require separate review. Catalogue writes and model calls: zero.",
    metrics: { referenceCases: rows.length, reviewedPublicMatches: rows.filter(r => Object.keys(r.checks).length).length, allMeasuredFieldsMatch: rows.filter(r => r.state === "matches_reference").length,
      fieldDiscrepancies: rows.filter(r => r.state === "field_discrepancy").length, noReviewedPublicMatch: rows.filter(r => r.state === "no_reviewed_public_match").length }, rows };
  const out = arg("out") ?? "tmp/reference-catalogue-latest.json";
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report.metrics, catalogueWrites: 0, modelCalls: 0, report: out }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
