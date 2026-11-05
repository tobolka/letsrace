import { createHash } from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all";
import { askJson, LlmResponseError, LlmUnavailable } from "@/lib/llm/anthropic";
import { cachedExtraction } from "@/lib/llm/extraction-cache";
import { alreadyRead, markRead } from "@/lib/catalog/facts";
import { readDocument } from "@/lib/catalog/regulation-ages";
import { pageAsText } from "@/lib/watcher/extractors/llm-calendar";
import { isAggregatorUrl, isDumpListingUrl } from "@/lib/watcher/public-url";
import { PRACTICAL_EXTRACTION_PROMPT, PRACTICAL_READER_VERSION, PRACTICAL_RESPONSE_SCHEMA, practicalIdentityLines, resolvePracticalEvidence, verifyPracticalExtraction, type PracticalDocument } from "./practical-extraction";
import { mergePracticalDetails, practicalDetailsSchema, readPracticalDetails, type PracticalDetails } from "@/lib/practical-details";
import { fairCatalogueBatch } from "./overview-quality";
import { combinePracticalFindings, practicalProgramme } from "./practical-programme";
import { publicLink } from "@/lib/practical-details";
import type { Json } from "@/lib/supabase/database.types";
import { localSourceReader } from "./local-source-cache";
import { resolve } from "node:path";
import { isAccountOrNewsletterUrl } from "@/lib/watcher/registration-url";

export function practicalWindows(text: string, max = 6000) {
  const spans: [number, number][] = [[0, Math.min(1200, text.length)]];
  for (const match of text.matchAll(/areál|venue|address|adresa|kontakt|pořadat|poradat|organis|organiz|veranstalt|start|program|schedule|entry|fee|startovn|cena|price|preis|trasa|route|distance|délka|povrch|surface|gpx|mapa|elev|převýš/gi)) {
    const from = Math.max(0, match.index - 250), to = Math.min(text.length, match.index + 650);
    const last = spans.at(-1)!;
    if (from <= last[1]) last[1] = Math.max(last[1], to); else spans.push([from, to]);
  }
  return spans.map(([from, to]) => text.slice(from, to)).join("\n[…]\n").slice(0, max);
}

/** Website suitability and document evidence are different: an attached PDF
 * remains usable even when its calendar host is not a race website. The usual
 * identity, edition and per-field evidence checks still apply after reading. */
export function isPracticalDocumentUrl(url: string | null | undefined): url is string {
  return Boolean(url && publicLink.safeParse(url).success && !isAccountOrNewsletterUrl(url) && !/\/konto\/(?:register|login)(?:[/?]|$)/i.test(url) && (!isAggregatorUrl(url) || /\.pdf$/i.test(new URL(url).pathname)));
}

export function practicalSeedUrls(row: { regulations_url?: string | null; website_url?: string | null; registration_url?: string | null }): string[] {
  return [...new Set([row.regulations_url, row.website_url, row.registration_url].filter(isPracticalDocumentUrl))];
}

/** Never fan out through a federation directory or an entry platform listing.
 * Their attached seed documents are still read; unrelated races' files are not. */
export function practicalChildLinks(url: string, links: Iterable<string>, row: { registration_url?: string | null; website_url?: string | null }): string[] {
  if (isDumpListingUrl(url) || url === row.registration_url && url !== row.website_url) return [];
  return [...links].filter(link => {
    if (!isPracticalDocumentUrl(link)) return false;
    const path = decodeURIComponent(new URL(link).pathname);
    if (/\.(?:gpx|kml|kmz)$/i.test(path) || /(?:^|\/)(?:results|ergebnisse|vysledky|archiv|archive)(?:[\/._-]|$)/i.test(path)) return false;
    return /\.pdf$/i.test(path) || /kontakt|contact|propoz|regulation|ausschreibung|program|schedule|trasy?|routes?/i.test(path) && new URL(link).hostname === new URL(url).hostname;
  });
}

/** Rotate bounded child reads so a long navigation cannot starve later rules. */
export function rotatePracticalLinks(links: string[], attempts: number): string[] {
  const unique = [...new Set(links)];
  if (!unique.length) return unique;
  const offset = Math.max(0, Math.trunc(attempts)) % unique.length;
  return [...unique.slice(offset), ...unique.slice(0, offset)];
}

export async function savePracticalDetails(eventId: string, revision: string, details: PracticalDetails) {
  const db = createServerSupabase();
  const { data: stored, error: readError } = await db.from("events").select("practical_details,public_revision").eq("id", eventId).single();
  if (readError) throw Error(readError.message);
  if (stored.public_revision !== revision) return { status: "changed" };
  const parsed = mergePracticalDetails(readPracticalDetails(stored.practical_details), practicalDetailsSchema.parse(details));
  const { data, error } = await createServerSupabase().rpc("pipeline_save_practical_details", { p_event: eventId, p_expected: revision, p_details: parsed as unknown as Json });
  if (error) throw Error(`Saving practical race facts: ${error.message}`);
  return data as { status: string; changed?: string[]; skipped?: string[] };
}

/** Follow actual official links; no search charges, constructed URLs or new race writes. */
export async function enrichPracticalDetails(options: { max?: number; ids?: string[]; apply?: boolean; structuredOnly?: boolean; deadline?: number; log?: (line: string) => void; audit?: (value: unknown) => void | Promise<void> } = {}) {
  const db = createServerSupabase(), deadline = options.deadline ?? Date.now() + 8 * 60_000;
  const probe = `${PRACTICAL_READER_VERSION}${options.structuredOnly ? ":structured-v2" : ""}`;
  const probes = await readAllRows((from, to) => db.from("catalog_probes").select("event_id,outcome,last_attempt_at,attempts").eq("probe", probe).order("event_id").range(from, to));
  const history = new Map(probes.map(p => [p.event_id, p]));
  const today = new Date().toISOString().slice(0, 10);
  const rows = await readAllRows((from, to) => {
    let query = db.from("events").select("id,name,start_date,end_date,public_revision,practical_details,website_url,registration_url,regulations_url,location:locations(venue,country_code)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).or("website_url.not.is.null,regulations_url.not.is.null,registration_url.not.is.null").order("start_date").order("id").range(from, to);
    if (options.ids?.length) query = query.in("id", options.ids);
    return query;
  });
  const wantedCountries = process.env.CATALOG_COUNTRIES?.split(",");
  const targets = rows.filter(row => {
    if (!practicalSeedUrls(row).length) return false;
    if (wantedCountries && !options.ids?.length && !wantedCountries.includes(row.location?.country_code ?? "")) return false;
    const previous = history.get(row.id), days = previous?.outcome === "failed" ? 3 : 14;
    return Boolean(options.ids?.length || !previous || Date.now() - Date.parse(previous.last_attempt_at) > days * 86400000);
  }).sort((a, b) => Object.keys(readPracticalDetails(a.practical_details)).length - Object.keys(readPracticalDetails(b.practical_details)).length);
  const batch = fairCatalogueBatch(targets, options.max ?? 12, row => row.location?.country_code ?? "unknown");
  const result = { eligible: targets.length, considered: batch.length, read: 0, changedFacts: 0, changedRaces: 0, skippedLocked: 0, unchanged: 0, partialReads: 0, deferred: 0, failed: 0, costUsd: 0, downloadedDocuments: 0, reusedDocuments: 0 };
  const shared = process.env.SOURCE_DOCUMENT_CACHE_DIR ? localSourceReader({
    directory: resolve(process.env.SOURCE_DOCUMENT_CACHE_DIR, "practical-v1"), maxAgeMs: 15 * 60_000,
    deadline, stopped: () => false, read: url => readDocument(url, { maxBytes: 4 * 1024 * 1024 }),
  }) : null;
  const documentsByUrl = new Map<string, ReturnType<typeof readDocument>>();
  const readOnce = (raw: string) => {
    const url = raw.replace(/#.*$/, "");
    if (documentsByUrl.has(url)) { result.reusedDocuments++; return documentsByUrl.get(url)!; }
    const request = shared ? shared.read(url) : readDocument(url, { maxBytes: 4 * 1024 * 1024 }).then(doc => { if (doc) result.downloadedDocuments++; return doc; });
    documentsByUrl.set(url, request);
    return request;
  };
  for (const row of batch) {
    let deferred = false;
    const defer = () => { if (!deferred) { result.deferred++; deferred = true; } };
    if (Date.now() + 60_000 >= deadline) { defer(); break; }
    const queue = practicalSeedUrls(row);
    const checkpointUrl = isPracticalDocumentUrl(row.website_url) ? row.website_url : queue[0];
    const documents: PracticalDocument[] = [], seen = new Set<string>();
    let unreadable = 0;
    let checkpoint: "failed" | "silent" | null = null;
    try {
      while (queue.length && seen.size < 5 && Date.now() + 30_000 < deadline) {
        const url = queue.shift()!;
        if (seen.has(url) || !isPracticalDocumentUrl(url)) continue;
        seen.add(url);
        const doc = await readOnce(url).catch(() => null);
        if (!doc?.text.trim()) { unreadable++; continue; }
        const source = doc.html ? pageAsText(doc.html, url) : { text: doc.text, links: new Set<string>() };
        documents.push({ url, text: source.text, links: [...source.links] });
        const children = practicalChildLinks(url, source.links, row).filter(link => !seen.has(link));
        queue.push(...rotatePracticalLinks(children, Number(history.get(row.id)?.attempts ?? 0)));
      }
      if (!documents.length) { result.failed++; checkpoint = "failed"; continue; }
      const partial = unreadable > 0 || queue.some(url => !seen.has(url) && isPracticalDocumentUrl(url));
      if (partial) { result.partialReads++; defer(); }
      const hash = createHash("sha256").update(JSON.stringify({ documents, name: row.name, startDate: row.start_date, endDate: row.end_date, knownVenue: row.location?.venue })).digest("hex"), reader = `${probe}:${row.id}`;
      if (await alreadyRead(db, checkpointUrl, reader, hash)) { result.unchanged++; checkpoint = partial ? "failed" : "silent"; continue; }
      if (Date.now() + 10_000 >= deadline) { defer(); break; }
      const context = { name: row.name, startDate: row.start_date, endDate: row.end_date, knownVenue: row.location?.venue ?? undefined, documents };
      let deterministic: PracticalDetails = {};
      for (const document of documents) deterministic = combinePracticalFindings(deterministic, practicalProgramme(document, context));
      const fieldsNeeded = ["venue", "organizer", "schedule", "fees", "routes"].filter(field => !(field in deterministic));
      const user = JSON.stringify({ fieldsNeeded, race: { name: row.name, startDate: row.start_date, endDate: row.end_date, knownVenue: row.location?.venue }, documents: documents.map(doc => ({ ...doc, candidateIdentityLines: practicalIdentityLines(row.name, doc.text), text: doc.text.split("\n").map((line, index) => `${index + 1}: ${line}`).join("\n").slice(0, 40000), links: doc.links.slice(0, 100) })) });
      let raw: unknown = { facts: {} }, modelDeferred = false;
      let usage = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
      if (!options.structuredOnly && fieldsNeeded.length) {
        try {
          const reply = await cachedExtraction({ version: probe, system: PRACTICAL_EXTRACTION_PROMPT, schema: PRACTICAL_RESPONSE_SCHEMA, eventId: row.id, sourceHash: hash, user }, async () => {
            const answer = await askJson<unknown>({ system: PRACTICAL_EXTRACTION_PROMPT, user, outputSchema: PRACTICAL_RESPONSE_SCHEMA, maxTokens: 5000, timeoutMs: Math.max(1000, Math.min(60000, deadline - Date.now() - 10000)) });
            return { value: answer.json, usage: answer.usage };
          });
          raw = reply.value; usage = reply.usage;
        } catch (error) {
          const invalidRequest = error instanceof Error && /^Anthropic API 400:/.test(error.message);
          if (!(error instanceof LlmUnavailable) && !(error instanceof LlmResponseError) && !invalidRequest) throw error;
          if (error instanceof LlmResponseError) usage = error.usage;
          defer(); modelDeferred = true; options.log?.(error instanceof Error ? error.message : "Model request deferred");
        }
      }
      result.costUsd += usage.costUsd; result.read++;
      const checked = verifyPracticalExtraction(resolvePracticalEvidence(raw, documents), context);
      checked.details = combinePracticalFindings(checked.details, deterministic);
      await options.audit?.({ id: row.id, raw, documents, checked, usage });
      options.log?.(JSON.stringify({ id: row.id, name: row.name, documents: documents.length, details: checked.details, rejected: checked.rejected, dry: !options.apply }));
      if (options.apply) {
        const saved = await savePracticalDetails(row.id, row.public_revision, checked.details);
        if (saved.status !== "saved") { defer(); continue; }
        result.changedFacts += saved.changed?.length ?? 0; result.changedRaces += Number(Boolean(saved.changed?.length)); result.skippedLocked += saved.skipped?.length ?? 0;
        // Failed/partial source reads remain retryable, even after useful other facts were saved.
        if (!partial && !modelDeferred) await markRead(db, checkpointUrl, reader, hash);
        checkpoint = modelDeferred ? null : partial ? "failed" : "silent";
      }
      if (modelDeferred) break;
    } catch (error) {
      if (error instanceof LlmUnavailable) { defer(); options.log?.(error.message); break; }
      if (error instanceof LlmResponseError) { result.costUsd += error.usage.costUsd; defer(); options.log?.(error.message); break; }
      result.failed++; options.log?.(`${row.id}: ${error instanceof Error ? error.message : "Practical enrichment failed"}`);
      unreadable++; checkpoint = "failed";
    } finally {
      if (options.apply && checkpoint && seen.size && Date.now() < deadline) {
        // Never stamp a budget/provider interruption as a completed silent read.
        const previous = history.get(row.id);
        const { error } = await db.from("catalog_probes").upsert({ event_id: row.id, probe, outcome: checkpoint, attempts: Number(previous?.attempts ?? 0) + 1, last_attempt_at: new Date().toISOString() }, { onConflict: "event_id,probe" });
        if (error) throw Error(`Saving practical reader checkpoint: ${error.message}`);
      }
    }
  }
  if (shared) { result.downloadedDocuments = shared.stats().downloaded; result.reusedDocuments += shared.stats().cached; }
  return result;
}
