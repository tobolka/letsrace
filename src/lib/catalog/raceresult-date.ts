import { gatherDossier } from "@/lib/catalog/dossier";

export function nearbyEditionDate(current: string, start: string | null, end: string | null): boolean {
  return Boolean(start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && start === end && current.slice(0, 4) === start.slice(0, 4)
    && Math.abs(Date.parse(current) - Date.parse(start)) <= 7 * 86_400_000);
}

/** Independently corroborate a nearby platform date with the organiser's dated guide. */
export async function corroborateRaceResultDate(eventId: string, name: string, publishedDate: string) {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = fold(name).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !/^(202\d|hillclimb|rennen|race|racing|cycling|tour|bike|gravel|mountain|mountainbike|meisterschaft)$/.test(word));
  if (!words.length) return null;
  const matches = (text: string) => words.every((word) => fold(text).includes(word));
  const docs = await gatherDossier({ startDate: publishedDate, website: `https://my.raceresult.com/${eventId}/`, registration: null, regulations: null, sources: [], maxDocs: 6 });
  const guide = docs.find((doc) => /\.pdf(?:\?|$)/i.test(doc.url) && doc.thisEdition && matches(doc.text));
  if (!guide) return null;
  const organiser = docs.find((doc) => doc.thisEdition && matches(doc.text) && !/my\.raceresult\.com|\.pdf(?:\?|$)/i.test(doc.url));
  return { sourceUrl: guide.url, websiteUrl: organiser?.url ?? null, quote: `Public registration date ${publishedDate}; organiser guide: ${guide.text.slice(0, 350).replace(/\s+/g, " ")}` };
}

/** Keep a corroborated date against a nearby conflicting calendar listing. */
export function verifiedDetailSpan(current: { start: string; end: string | null }, incomingDate: string, facts: { field: string; value: unknown }[]) {
  const start = facts.find((fact) => fact.field === "start_date")?.value;
  const end = facts.find((fact) => fact.field === "end_date")?.value;
  return typeof start === "string" && typeof end === "string" && start === current.start && end === current.end && nearbyEditionDate(incomingDate, start, end)
    ? { start, end } : null;
}
