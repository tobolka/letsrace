import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEvent } from "@/lib/domain";
import { recordFacts, textHash, alreadyRead, markRead } from "@/lib/catalog/facts";
import { gatherDossier, type DossierDoc } from "@/lib/catalog/dossier";
import { readDocument, type ReadDoc } from "@/lib/catalog/regulation-ages";

/** Keep the complete source result even when a single display field chooses another value. */
export async function saveSourceEvidence(s: SupabaseClient, eventId: string, watchedUrlId: string, kind: string, event: ParsedEvent) {
  const value = { watchedUrlId, kind, event };
  const hash = textHash(JSON.stringify(value));
  const reader = `source-evidence-v1:${watchedUrlId}:${event.externalId}:${eventId}`;
  if (await alreadyRead(s, event.sourceUrl, reader, hash)) return;
  await recordFacts(s, eventId, [{ field: "source_evidence", value, previous: null, sourceUrl: event.sourceUrl }], { method: "watcher_source_evidence", version: "source-evidence-v1" });
  await markRead(s, event.sourceUrl, reader, hash);
}

/** Latest result from each source/edition, without discarding alternative links or classes. */
export async function readSourceEvidence(s: SupabaseClient, eventId: string): Promise<ParsedEvent[]> {
  const seen = new Set<string>();
  const out: ParsedEvent[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await s.from("event_facts").select("value").eq("event_id", eventId)
      .eq("method", "watcher_source_evidence").eq("field", "source_evidence").eq("status", "active")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const v = row.value as { watchedUrlId?: string; event?: ParsedEvent } | null;
      if (!v?.event?.externalId || !v.event.sourceUrl) continue;
      const key = `${v.watchedUrlId}:${v.event.externalId}`;
      if (!seen.has(key)) { seen.add(key); out.push(v.event); }
    }
    if (!data || data.length < 500) break;
  }
  return out;
}

/** True when a source other than an aggregator last reported this start date for the race. */
export async function startDateConfirmedOutsideAggregators(s: SupabaseClient, eventId: string, startDate: string): Promise<boolean> {
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await s.from("event_facts").select("value").eq("event_id", eventId)
      .eq("method", "watcher_source_evidence").eq("field", "source_evidence").eq("status", "active")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const v = row.value as { watchedUrlId?: string; kind?: string; event?: ParsedEvent } | null;
      if (!v?.event?.externalId) continue;
      const key = `${v.watchedUrlId}:${v.event.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (v.kind !== "aggregator" && v.event.startDate === startDate) return true;
    }
    if (!data || data.length < 500) break;
  }
  return false;
}

/** Each source gets its own document budget; shared URLs are fetched once. */
export async function gatherEventDossier(s: SupabaseClient, eventId: string, race: Parameters<typeof gatherDossier>[0], extra: ParsedEvent[] = []): Promise<DossierDoc[]> {
  const evidence = [...await readSourceEvidence(s, eventId), ...extra];
  const reads = new Map<string, Promise<ReadDoc | null>>();
  const read = (url: string) => {
    const key = url.replace(/#.*$/, "");
    if (!reads.has(key)) reads.set(key, (race.read ?? readDocument)(key).catch(() => null));
    return reads.get(key)!;
  };
  const seeds = [
    { ...race, sources: [] as string[] },
    ...race.sources.map(url => ({ ...race, website: null, registration: null, regulations: null, sources: [url] })),
    // Every explicitly supplied URL must be read: a site's many linked rules
    // must not push the source detail or registration beyond its budget.
    ...evidence.flatMap(event => [
      { ...race, website: null, registration: null, regulations: null, sources: [event.sourceUrl] },
      ...(event.websiteUrl ? [{ ...race, website: event.websiteUrl, registration: null, regulations: null, sources: [] }] : []),
      ...(event.registrationUrl ? [{ ...race, website: null, registration: event.registrationUrl, regulations: null, sources: [] }] : []),
      ...(event.regulationsUrl ? [{ ...race, website: null, registration: null, regulations: event.regulationsUrl, sources: [] }] : []),
    ]),
  ];
  const signatures = new Set<string>();
  const docs = new Map<string, DossierDoc>();
  for (const seed of seeds) {
    const signature = JSON.stringify([seed.website, seed.registration, seed.regulations, seed.sources]);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    for (const doc of await gatherDossier({ ...seed, read })) {
      const held = docs.get(doc.url);
      docs.set(doc.url, { ...doc, linkedFromEdition: held?.linkedFromEdition || doc.linkedFromEdition,
        kind: held && held.kind !== "listing" ? held.kind : doc.kind });
    }
  }
  return [...docs.values()];
}
