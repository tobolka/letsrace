import { normalizeName } from "@/lib/domain";
import { discoveryUrl } from "./plan";
import type { DiscoveryState, Task } from "./store";
import { assessCandidate } from "./assessment";
import { discoveryContributions } from "./contributions";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";

export type BenchmarkRow = { name: string; dateText: string; url: string; place: string; discipline: string };

/** RFC-style quoting, including escaped quotes, semicolons and multiline fields. */
export function parseBenchmark(text: string): BenchmarkRow[] {
  const table: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else field += char;
    } else if (!quoted && (char === ";" || char === "\n")) {
      row.push(field.replace(/\r$/, "")); field = "";
      if (char === "\n") { if (row.some(Boolean)) table.push(row); row = []; }
    } else field += char;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(field.replace(/\r$/, "")); if (row.some(Boolean)) table.push(row);
  const header = table.shift();
  if (header?.join(";") !== "Datum 2027;Závod;Odkaz;Místo;Série / disciplína") throw new Error("Unexpected benchmark CSV columns");
  return table.map((r, i) => {
    if (r.length !== 5 || !r[1]?.trim() || !discoveryUrl(r[2])) throw new Error(`Invalid benchmark row ${i + 2}`);
    return { dateText: r[0], name: r[1], url: r[2], place: r[3], discipline: r[4] };
  });
}

export function claimedDate(text: string, season: number) {
  const precision = text.includes("*") ? "tentative" : "day";
  const match = text.replace(/\*/g, "").trim().match(/^(\d{1,2})\.\s*(?:[–-]\s*(\d{1,2})\.)?\s*(\d{1,2})\.$/);
  if (!match) return { precision: "month_or_unknown", start: null, end: null };
  const date = (day: string) => `${season}-${match[3].padStart(2, "0")}-${day.padStart(2, "0")}`;
  const start = date(match[1]), end = date(match[2] ?? match[1]);
  if (![start, end].every(d => !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d) || end < start) throw new Error(`Invalid benchmark date ${text}`);
  return { precision, start, end };
}

/** Suggestions only: never a merge or a publication decision. */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a), y = normalizeName(b);
  if (x === y && x.length >= 2) return 1;
  const ax = new Set(x.split(" ").filter(w => w.length >= 3));
  const by = new Set(y.split(" ").filter(w => w.length >= 3));
  if (!ax.size || !by.size) return 0;
  const common = [...ax].filter(w => by.has(w)).length;
  return common / Math.max(ax.size, by.size);
}

export type CatalogRow = { id: string; name: string; start_date: string; visibility: string; status: string; merged_into_id: string | null; website_url: string | null; country: string | null };

/** A review inbox, never an insert/merge verdict. Include hidden and old editions. */
export function reviewDiscoveryCandidates(state: DiscoveryState, catalog: CatalogRow[] | null) {
  const host = (url: string | null) => {
    try { return new URL(url ?? "").hostname.replace(/^www\./, ""); } catch { return null; }
  };
  return Object.values(state.candidates).map(candidate => {
    const event = candidate.event, assessment = assessCandidate(event, state.country);
    const quote = event.evidence?.quote;
    const dateSupported = Boolean(quote && quoteStatesDate(quote, event.startDate));
    const suggestions = (catalog ?? []).map(row => ({ ...row, similarity: nameSimilarity(event.name, row.name) }))
      .filter(row => row.similarity >= 0.6 && (!row.country || row.country === (state.country ?? "CZ")) && (!event.countryHint || !row.country || row.country === event.countryHint))
      .sort((a, b) => b.similarity - a.similarity || Number(b.start_date === event.startDate) - Number(a.start_date === event.startDate));
    const sameSeason = suggestions.filter(row => row.start_date.slice(0, 4) === event.startDate.slice(0, 4));
    // Same site is useful for aliases/sponsor changes, but a shared calendar
    // domain alone is never evidence that two races are the same identity.
    const sourceHost = host(candidate.sourceUrl);
    const sourceSuggestions = (catalog ?? []).filter(row => sourceHost && host(row.website_url) === sourceHost);
    const category = assessment.state === "out_of_scope" ? "out_of_scope"
      : !dateSupported ? "date_evidence_review"
      : assessment.dateStatus === "tentative" ? "tentative"
      : catalog === null ? "catalogue_not_loaded"
      : sameSeason.some(row => row.start_date === event.startDate) ? "possible_existing_edition"
      : sameSeason.length ? "possible_date_or_identity_conflict"
      : suggestions.length ? "possible_missing_edition"
      : sourceSuggestions.length ? "shared_source_identity_review" : "identity_review";
    return { candidateId: candidate.id, name: event.name, startDate: event.startDate, endDate: event.endDate ?? null,
      place: event.placeText, sourceUrl: candidate.sourceUrl, snapshot: candidate.snapshot, quote: quote ?? null,
      dateSupported, category, issues: assessment.issues, catalogueSuggestions: suggestions.slice(0, 8),
      catalogueSourceSuggestions: sourceSuggestions.slice(0, 8), publicationApproved: false };
  });
}

export function discoveryReport(state: DiscoveryState, benchmark: BenchmarkRow[], season: number, catalog: CatalogRow[] | null) {
  const tasks = Object.values(state.tasks), candidates = Object.values(state.candidates).map(c => ({ ...c, ...assessCandidate(c.event, state.country) }));
  const blindReads = tasks.filter((t): t is Task & { kind: "read" } => t.kind === "read" && t.lane === "blind");
  const taskIds = (url: string, lane: "blind" | "benchmark") => new Set(tasks.filter(t => t.kind === "read" && t.lane === lane && discoveryUrl(t.url) === discoveryUrl(url)).map(t => t.id));
  const rows = benchmark.map(row => {
    const date = claimedDate(row.dateText, season);
    const matched = (lane: "blind" | "benchmark") => {
      const ids = taskIds(row.url, lane);
      return candidates.filter(c => c.origins.some(id => ids.has(id)) && nameSimilarity(row.name, c.event.name) >= 0.6)
        .map(c => ({ id: c.id, name: c.event.name, startDate: c.event.startDate, dateMatchesCsvClaim: date.start ? c.event.startDate === date.start : null,
          evidence: c.event.evidence ?? null, state: c.state }));
    };
    const ids = taskIds(row.url, "benchmark");
    return { ...row, claimedDate: date,
      sourceFoundBlind: blindReads.some(t => discoveryUrl(t.url) === discoveryUrl(row.url)),
      benchmarkReads: tasks.filter(t => ids.has(t.id)).map(t => ({ status: t.status, error: t.error, result: t.result })),
      benchmarkCandidates: matched("benchmark"), blindCandidatesOnThisUrl: matched("blind"),
      catalogSuggestions: catalog === null ? null : catalog.filter(c => c.country === "CZ" || c.country === null)
        .map(c => ({ ...c, similarity: nameSimilarity(row.name, c.name) }))
        .filter(c => c.similarity >= 0.6).sort((a, b) => b.similarity - a.similarity || Math.abs(Number(a.start_date.slice(0, 4)) - season) - Math.abs(Number(b.start_date.slice(0, 4)) - season)).slice(0, 5),
    };
  });
  return {
    generatedAt: new Date().toISOString(), season, country: state.country ?? "CZ", readerVersion: state.readerVersion ?? "legacy pilot",
    publication: "No event writes. Extraction and name matches require review.",
    metrics: { tasks: tasks.length, states: Object.fromEntries(["pending", "running", "done", "retry"].map(s => [s, tasks.filter(t => t.status === s).length])),
      blindSources: blindReads.length, extractedAssertions: candidates.length,
      reviewAssertions: candidates.filter(c => c.state === "needs_review").length, outOfScopeAssertions: candidates.filter(c => c.state === "out_of_scope").length,
      // Same name/date from two sources is only a provisional grouping, not an identity verdict.
      provisionalNameDateGroups: new Set(candidates.map(c => `${normalizeName(c.event.name)}:${c.event.startDate}`)).size,
      searchModelCostUsd: tasks.filter(t => t.kind === "search").reduce((n, t) => n + (t.history ?? [{ result: t.result }]).reduce((s, h) => s + Number((h.result as { modelCostUsd?: number })?.modelCostUsd ?? 0), 0), 0),
      readModelCostUsd: tasks.filter(t => t.kind === "read").reduce((n, t) => n + (t.history ?? [{ result: t.result }]).reduce((s, h) => s + Number((h.result as { modelCostUsd?: number })?.modelCostUsd ?? 0), 0), 0),
      benchmarkRows: benchmark.length, csvSourceUrlsFoundBlind: rows.filter(r => r.sourceFoundBlind).length,
      benchmarkRowsWithMatchingDateSuggestion: rows.filter(r => r.claimedDate.precision === "day" && r.benchmarkCandidates.some(c => c.dateMatchesCsvClaim)).length },
    contributions: discoveryContributions(state), searches: tasks.filter(t => t.kind === "search"), candidates, benchmark: rows,
    candidateReview: reviewDiscoveryCandidates(state, catalog),
    limitations: ["CSV is a diagnostic list, not verified ground truth.", "Source URL recall is not race recall; other valid URLs may describe the same race.",
      "Name suggestions include hidden and merged rows and are never automatic matches.", "Source authority, race identity, place and tentative status need review before publication.",
      "Reported model costs exclude independent search API billing; failed attempts remain in search artifacts/logs."],
  };
}
