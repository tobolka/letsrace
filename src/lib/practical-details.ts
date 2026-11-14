import { quoteIsNotTheStart } from "@/lib/catalog/place-roles";
import { z } from "zod";

const text = z.string().trim().min(1).max(200);
export const publicLink = z.url().max(2000).refine(value => { try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }, "Expected a public web link");
const evidence = { sourceUrl: publicLink, quote: z.string().trim().min(8).max(1500), checkedAt: z.iso.datetime({ offset: true }), editionYear: z.number().int().min(2000).max(2100), status: z.enum(["current", "year_neutral", "inherited"]), originEventId: z.uuid().optional() };
const itemEvidence = { sourceQuote: z.string().min(5).max(1500).optional(), sourceUrl: publicLink.optional(), checkedAt: z.iso.datetime({ offset: true }).optional() };
export const practicalValueSchemas = {
  venue: z.object({ name: text, streetAddress: text.optional(), postalCode: z.string().trim().min(1).max(20).optional(), locality: text.optional(), countryCode: z.string().regex(/^[A-Z]{2}$/).optional(), precision: z.enum(["venue", "start", "municipality"]) }).strict(),
  organizer: z.object({ name: text, url: publicLink.optional(), contactName: text.optional(), phone: z.string().trim().min(5).max(40).optional(), email: z.string().trim().email().max(200).optional() }).strict(),
  parking: z.object({ note: z.string().trim().min(3).max(400) }).strict(),
  documents: z.array(z.object({ kind: z.enum(["regulations", "instructions", "series_rules"]), url: publicLink }).strict()).min(1),
  categories: z.array(z.object({ ...itemEvidence, label: text, birthYears: z.string().trim().min(4).max(40).optional() }).strict()).min(1),
  schedule: z.array(z.object({ ...itemEvidence, approximate: z.boolean().optional(), label: text, date: z.iso.date(), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/), endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(), timeZone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }).optional() }).strict()).min(1).max(40),
  fees: z.array(z.object({ ...itemEvidence, label: text, amount: z.number().min(0).max(1000000), currency: z.string().regex(/^[A-Z]{3}$/), validUntil: z.iso.date().optional(), url: publicLink.optional() }).strict()).min(1).max(100),
  routes: z.array(z.object({ ...itemEvidence, name: text, distanceKm: z.number().positive().max(20000).optional(), elevationM: z.number().nonnegative().max(300000).optional(), surface: text.optional(), gpxUrl: publicLink.optional(), mapUrl: publicLink.optional() }).strict()).min(1).max(30),
};
export const practicalDetailsSchema = z.object({
  venue: z.object({ ...evidence, value: practicalValueSchemas.venue }).strict().optional(),
  organizer: z.object({ ...evidence, value: practicalValueSchemas.organizer }).strict().optional(),
  parking: z.object({ ...evidence, value: practicalValueSchemas.parking }).strict().optional(),
  documents: z.object({ ...evidence, value: practicalValueSchemas.documents }).strict().optional(),
  categories: z.object({ ...evidence, value: practicalValueSchemas.categories, status: z.literal("current") }).strict().optional(),
  schedule: z.object({ ...evidence, value: practicalValueSchemas.schedule, status: z.literal("current") }).strict().optional(),
  fees: z.object({ ...evidence, value: practicalValueSchemas.fees, status: z.literal("current") }).strict().optional(),
  routes: z.object({ ...evidence, value: practicalValueSchemas.routes, status: z.literal("current") }).strict().optional(),
}).strict();
export type PracticalDetails = z.infer<typeof practicalDetailsSchema>;
export type PracticalField = keyof PracticalDetails;

/** Corrupt/unknown fields do not hide the other independently valid facts. */
export function readPracticalDetails(value: unknown): PracticalDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const field of Object.keys(practicalValueSchemas) as PracticalField[]) {
    const parsed = practicalDetailsSchema.shape[field].safeParse((value as Record<string, unknown>)[field]);
    if (parsed.success && parsed.data) result[field] = parsed.data;
  }
  return result as PracticalDetails;
}

/** A changed edition/date must not keep presenting the old programme as current. */
export function practicalDetailsForEvent(value: unknown, startDate: string, endDate?: string | null): PracticalDetails {
  const details = readPracticalDetails(value);
  const year = Number(startDate.slice(0, 4));
  for (const field of Object.keys(details) as PracticalField[]) {
    if (details[field]?.editionYear !== year) delete details[field];
  }
  // A venue quoted from a depot, a stage end, the finish or the club's seat is not where the race is held
  // ("Konec E1: Depo Olomouc" for a race that starts in Dolní Morava). Such facts read before this check stay stored but unshown.
  if (details.venue && quoteIsNotTheStart(details.venue.quote)) delete details.venue;
  if (details.schedule) {
    const items = details.schedule.value.filter(item => item.date >= startDate && item.date <= (endDate ?? startDate));
    if (items.length) details.schedule = { ...details.schedule, value: items };
    else delete details.schedule;
  }
  return details;
}

export const practicalCopy = {
  cs: { title: "Před cestou na závod", venue: "Areál a adresa", organizer: "Pořadatel", schedule: "Program a starty", fees: "Startovné", routes: "Tratě", parking: "Parkování", categories: "Kategorie", contact: "Kontakt", documents: "Dokumenty", regulationsDocument: "Propozice", instructions: "Organizační pokyny", seriesRules: "Pravidla série", source: "Zdroj", previous: "Z předchozího ročníku", neutral: "Údaj pořadatele bez určení ročníku", gpx: "Stáhnout GPX", map: "Mapa trasy", until: "do" },
  en: { title: "Before you travel", venue: "Venue and address", organizer: "Organiser", schedule: "Schedule and starts", fees: "Entry fees", routes: "Routes", parking: "Parking", categories: "Categories", contact: "Contact", documents: "Documents", regulationsDocument: "Regulations", instructions: "Race instructions", seriesRules: "Series rules", source: "Source", previous: "From a previous edition", neutral: "Year-neutral organiser information", gpx: "Download GPX", map: "Route map", until: "until" },
};

/** Positive facts from another source add variants; absence is not evidence of removal. */
type ListRow = { sourceUrl?: string; checkedAt?: string; date?: string; label?: string };
const NOT_A_PROGRAMME_ROW = /^(?:termin|start|startzeit|za[cč][aá]tek)$/i;

/**
 * Two documents are never mixed in a timetable, a fee list or the categories: their rows would repeat and
 * contradict each other, so the fullest list stands. Routes may add up, since another document can name a further course.
 */
export function tidyPracticalDetails(details: PracticalDetails): PracticalDetails {
  const result = { ...details } as Record<string, unknown>;
  for (const field of ["schedule", "fees", "categories"] as const) {
    const fact = details[field];
    if (!fact) continue;
    const rows = fact.value as unknown as ListRow[], source = (row: ListRow) => row.sourceUrl ?? fact.sourceUrl;
    const group = (row: ListRow) => field === "schedule" ? row.date ?? "" : "";
    const newest = new Map<string, string>(), winners = new Map<string, string>();
    for (const row of rows) if ((row.checkedAt ?? "") > (newest.get(source(row)) ?? "")) newest.set(source(row), row.checkedAt ?? "");
    for (const name of new Set(rows.map(group))) {
      const counts = new Map<string, number>();
      for (const row of rows) if (group(row) === name) counts.set(source(row), (counts.get(source(row)) ?? 0) + 1);
      winners.set(name, [...counts].sort((a, b) => b[1] - a[1] || (newest.get(b[0]) ?? "").localeCompare(newest.get(a[0]) ?? ""))[0]![0]);
    }
    let kept = rows.filter(row => winners.get(group(row)) === source(row));
    if (field === "schedule" && kept.some(row => !NOT_A_PROGRAMME_ROW.test(row.label ?? ""))) kept = kept.filter(row => !NOT_A_PROGRAMME_ROW.test(row.label ?? ""));
    result[field] = { ...fact, value: kept };
  }
  return result as PracticalDetails;
}

export function mergePracticalDetails(stored: PracticalDetails, incoming: PracticalDetails): PracticalDetails {
  const result = { ...incoming };
  const content = (value: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "checkedAt").sort(([a], [b]) => a.localeCompare(b))));
  for (const field of ["schedule", "fees", "routes", "categories"] as const) {
    const next = incoming[field], old = stored[field];
    if (!next || !old || old.editionYear !== next.editionYear) continue;
    type Item = Record<string, unknown>;
    const key = (item: Item) => JSON.stringify(field === "routes" ? [item.name] : field === "categories" ? [item.label] : field === "schedule" ? [item.label, item.date] : [item.label, item.currency, item.validUntil ?? null]);
    const previous = old.value as unknown as Item[];
    // Each reading of a document replaces its last one; what another document said stays for now.
    const readAgain = new Set((next.value as unknown as Item[]).map(item => item.sourceUrl ?? next.sourceUrl));
    const items = new Map(previous.map(item => [key(item), { ...item, sourceUrl: item.sourceUrl ?? old.sourceUrl, sourceQuote: item.sourceQuote ?? old.quote, checkedAt: item.checkedAt ?? old.checkedAt }]));
    const held = new Map(items);
    // A much shorter list is a partial reading rather than a correction, and routes may add up.
    const sameSource = [...items].filter(([, item]) => readAgain.has(item.sourceUrl));
    if (field !== "routes" && (next.value as unknown[]).length * 3 >= sameSource.length) for (const [name] of sameSource) items.delete(name);
    for (const item of next.value as unknown as Item[]) {
      const withSource = { ...item, sourceUrl: item.sourceUrl ?? next.sourceUrl, sourceQuote: item.sourceQuote ?? next.quote, checkedAt: item.checkedAt ?? next.checkedAt };
      const earlier = held.get(key(item));
      items.set(key(item), earlier && content(earlier) === content(withSource) ? earlier : withSource);
    }
    (result as Record<string, unknown>)[field] = { ...next, value: [...items.values()] };
  }
  return practicalDetailsSchema.parse(tidyPracticalDetails(result));
}
