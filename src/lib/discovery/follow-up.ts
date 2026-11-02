import type { Json } from "@/lib/supabase/database.types";
import type { ReviewRow } from "./review";
import { discoveryUrl } from "./plan";

const HOUR = 3_600_000;
export type FollowUpDocument = {
  url: string; outcome: "read" | "unavailable" | "blocked";
  documentHash?: string; textHash?: string; snapshot?: string; error?: string;
  organizerUrls?: string[]; linkedFrom?: string;
};
export type FollowUp = {
  version: 1; attempts: number; failures: number; checkedAt?: string;
  nextCheckAt: string; leaseUntil?: string;
  outcome?: "baseline" | "unchanged" | "changed" | "unavailable" | "blocked";
  needsReview: boolean; documents: FollowUpDocument[];
};

export function decisionObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function followUpOf(row: ReviewRow): FollowUp | undefined {
  const value = decisionObject(row.decision).followUp;
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) return;
  return value as unknown as FollowUp;
}

export function followUpDue(row: ReviewRow, now: number): boolean {
  if (!["pending", "waiting", "conflict"].includes(row.status)) return false;
  const previous = followUpOf(row);
  if (previous?.leaseUntil && Date.parse(previous.leaseUntil) > now) return false;
  // An interrupted claim has an expiry and remains retryable after it.
  return !previous?.nextCheckAt || !Number.isFinite(Date.parse(previous.nextCheckAt)) || Date.parse(previous.nextCheckAt) <= now;
}

/** Only explicit URLs: no generated next-year address or guessed organizer. */
export function followUpUrls(row: ReviewRow): string[] {
  const payload = decisionObject(row.payload);
  const extra = decisionObject(row.decision).recheckUrls;
  const linked = followUpOf(row)?.documents.filter(doc => doc.linkedFrom).map(doc => doc.url) ?? [];
  return [...new Set([row.source_url, payload.sourceUrl, payload.websiteUrl,
    ...(Array.isArray(extra) ? extra.slice(0, 4) : []), ...linked]
    .filter((url): url is string => typeof url === "string")
    .map(discoveryUrl).filter((url): url is string => Boolean(url)))].slice(0, 6);
}

/** Change detection is a reason to review evidence, never publication approval. */
export function finishFollowUp(row: ReviewRow, documents: FollowUpDocument[], now: number): FollowUp {
  const previous = followUpOf(row);
  const evidence = decisionObject(row.evidence);
  let compared = false, changed = false;
  for (const doc of documents.filter(d => d.outcome === "read")) {
    // Preserve the last successful baseline through network failures.
    const held = previous?.documents.find(d => d.url === doc.url && d.documentHash);
    const source = discoveryUrl(row.source_url) === doc.url;
    const raw = decisionObject(decisionObject(row.payload).evidence ?? null).method === "structured_calendar";
    const oldHash = raw ? held?.documentHash ?? (source ? evidence.documentHash : undefined)
      : held?.textHash ?? (source ? evidence.textHash : undefined);
    const currentHash = raw ? doc.documentHash : doc.textHash;
    if (typeof oldHash === "string" && currentHash) { compared = true; changed ||= oldHash !== currentHash; }
  }
  const unavailable = documents.some(d => d.outcome === "unavailable") || documents.length === 0;
  const blocked = documents.some(d => d.outcome === "blocked");
  const failures = unavailable ? (previous?.failures ?? 0) + 1 : 0;
  const needsReview = Boolean(previous?.needsReview || changed);
  const outcome = unavailable ? "unavailable" : blocked ? "blocked" : changed ? "changed" : compared ? "unchanged" : "baseline";
  const delay = unavailable ? [HOUR, 6 * HOUR, 24 * HOUR, 3 * 24 * HOUR, 7 * 24 * HOUR][Math.min(failures - 1, 4)]
    : blocked ? 7 * 24 * HOUR : needsReview ? 24 * HOUR : 7 * 24 * HOUR;
  return { version: 1, attempts: (previous?.attempts ?? 0) + 1, failures, checkedAt: new Date(now).toISOString(),
    nextCheckAt: new Date(now + delay).toISOString(), outcome, needsReview,
    documents: documents.map(doc => {
      const held = previous?.documents.find(d => d.url === doc.url);
      return doc.outcome === "read" ? doc : { ...held, ...doc };
    }) };
}
