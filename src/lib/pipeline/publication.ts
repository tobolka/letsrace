import { load } from "cheerio";
import type { Json } from "@/lib/supabase/database.types";
import { repairText } from "@/lib/text";

export type Publication = { revision: string; slug: string; previousSlugs?: string[]; expected: Record<string, Json | undefined> };
export function publicationPayload(value: Json): Publication {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.revision !== "string" || typeof value.slug !== "string" || !value.expected || typeof value.expected !== "object" || Array.isArray(value.expected)) throw Error("Invalid publication payload");
  return value as unknown as Publication;
}

/** A current database row is not proof that the public page carries its revision. */
export function verifyPublicRevision(html: string, status: number, publication: Publication, expectedVisible: boolean) {
  if (!expectedVisible) {
    if (status !== 404 && status !== 410) throw Error(`Hidden race still publicly available (HTTP ${status})`);
    return;
  }
  if (status !== 200) throw Error(`Race page returned HTTP ${status}`);
  const $ = load(html), article = $("article[data-race-revision]").first();
  if (article.attr("data-race-revision") !== publication.revision || article.attr("data-race-id") !== publication.expected.id) throw Error("Public race revision does not match the saved change");
  const events: Record<string, unknown>[] = [];
  function collect(value: unknown) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (item["@type"] === "SportsEvent") events.push(item);
    if (item["@graph"]) collect(item["@graph"]);
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try { collect(JSON.parse($(element).text())); } catch { /* A broken block must not count as evidence. */ }
  });
  const expected = publication.expected;
  const actual = events.find(event => event.name === repairText(String(expected.name)));
  if (!actual || actual.startDate !== expected.start_date || actual.endDate !== (expected.end_date ?? expected.start_date)) throw Error("Public race name or dates do not match the saved change");
  const schemaStatus = expected.status === "cancelled" ? "EventCancelled" : expected.status === "postponed" ? "EventPostponed" : "EventScheduled";
  if (actual.eventStatus !== `https://schema.org/${schemaStatus}`) throw Error("Public race status does not match the saved change");
  if (expected.registration_url && !$('a[href]').toArray().some(link => $(link).attr('href') === expected.registration_url)) throw Error("Saved registration link is missing from the public page");
}
