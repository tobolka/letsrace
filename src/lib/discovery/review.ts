import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { ParsedEvent } from "@/lib/domain";
import { discoveryUrl } from "./plan";
import { assessCandidate } from "./assessment";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";
import { overviewIssues } from "@/lib/catalog/overview-quality";

const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export type ReviewRow = Database["public"]["Tables"]["pipeline_candidates"]["Row"];
export type ReviewDecision = {
  id: string; evidenceHash: string; action: "publish" | "reject" | "wait";
  reason: string;
  /** null explicitly means a new edition; a UUID means an existing reviewed identity. */
  expectedEventId?: string | null;
  authority?: "official" | "national_federation" | "series";
  checked?: { identity: boolean; date: boolean; place: boolean; discipline: boolean; authority: boolean };
};

export function candidateAssertion(event: ParsedEvent, opts: { sourceUrl: string; documentHash: string; textHash?: string; reason: string; watchedUrlId?: string; country?: string }) {
  const sourceUrl = discoveryUrl(opts.sourceUrl);
  if (!sourceUrl || !opts.documentHash) throw new Error("Candidate needs a source and document hash");
  const payload = JSON.parse(JSON.stringify(event)) as Json;
  return { candidate_key: digest(`${sourceUrl}:${event.externalId}:${event.startDate.slice(0, 4)}`),
    evidence_hash: digest(JSON.stringify({ sourceUrl, documentHash: opts.textHash ?? opts.documentHash, textHash: opts.textHash, payload })),
    source_url: sourceUrl, watched_url_id: opts.watchedUrlId ?? null, country: opts.country ?? event.countryHint ?? null,
    season: Number(event.startDate.slice(0, 4)), payload,
    evidence: { documentHash: opts.documentHash, textHash: opts.textHash ?? null, quote: event.evidence?.quote ?? null, reader: event.evidence?.version ?? null } as Json,
    reason: opts.reason };
}

export async function saveCandidate(db: SupabaseClient<Database>, event: ParsedEvent, opts: Parameters<typeof candidateAssertion>[1]) {
  const row = candidateAssertion(event, opts);
  // A fresh document hash is not a fresh factual assertion. Keep explicit
  // reviews in force across changed navigation, counters and HTML decoration.
  const { data: reviewed, error: reviewError } = await db.from("pipeline_candidates")
    .select("payload").eq("candidate_key", row.candidate_key)
    .in("status", ["published", "rejected", "waiting"])
    .not("decision->>reviewedAt", "is", null);
  if (reviewError) throw new Error(`Reading candidate decision: ${reviewError.message}`);
  if (reviewed?.some(previous => sameCandidateFacts(previous.payload, row.payload))) return row;
  const { error } = await db.from("pipeline_candidates").upsert(row, { onConflict: "candidate_key,evidence_hash", ignoreDuplicates: true });
  if (error) throw new Error(`Saving candidate review: ${error.message}`);
  return row;
}

/** Evidence snapshots and confidence may change while the asserted facts do not. */
export function sameCandidateFacts(left: Json, right: Json): boolean {
  const canonical = (value: Json): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`).join(",")}}`;
  };
  const facts = (value: Json): Json => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !["evidence", "confidence"].includes(key)));
  };
  return canonical(facts(left)) === canonical(facts(right));
}

/** Human/agent review is bound to immutable evidence, never merely a model confidence. */
export function validateReview(row: ReviewRow, decision: ReviewDecision, today: string) {
  if (decision.id !== row.id || decision.evidenceHash !== row.evidence_hash) throw new Error("Review evidence changed; review again");
  if (!decision.reason?.trim() || !["publish", "reject", "wait"].includes(decision.action)) throw new Error("Explicit decision and reason required");
  if (decision.action !== "publish") return;
  if (!["pending", "waiting", "conflict"].includes(row.status)) throw new Error(`Candidate is ${row.status}; do not publish again`);
  if (!("expectedEventId" in decision) || decision.expectedEventId !== null && !/^[a-f0-9-]{36}$/i.test(decision.expectedEventId ?? "")) throw new Error("Explicit reviewed identity required");
  if (!["official", "national_federation", "series"].includes(decision.authority ?? "") || !["identity", "date", "place", "discipline", "authority"].every(k => decision.checked?.[k as keyof NonNullable<ReviewDecision["checked"]>] === true)) throw new Error("Basic facts and source authority must be reviewed");
  const event = row.payload as unknown as ParsedEvent;
  const assessment = assessCandidate(event, row.country ?? "CZ");
  if (assessment.state === "out_of_scope" || assessment.dateStatus === "tentative") throw new Error("Out-of-scope or tentative candidate cannot be published");
  if (!event.placeText.trim() || !event.countryHint || !event.discipline?.length) throw new Error("Missing place, country or discipline");
  if (overviewIssues({ name: event.name, start_date: event.startDate, end_date: event.endDate, status: event.status }, today).length) throw new Error("Basic data conflict requires review");
  if (event.startDate < today || Number(event.startDate.slice(0, 4)) !== row.season) throw new Error("Candidate is outside its reviewed future edition");
  if (!event.evidence?.quote || !quoteStatesDate(event.evidence.quote, event.startDate)) throw new Error("Missing date evidence");
  if (discoveryUrl(event.evidence.sourceUrl) !== row.source_url) throw new Error("Evidence belongs to another source");
}
