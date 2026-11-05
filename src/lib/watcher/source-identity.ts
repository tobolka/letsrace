import { scoreDuplicate, hasIdentityConflict, type DedupEvent } from "@/lib/dedup";

/** External ids can be reused next season; never overwrite a previous edition. */
export function sourceEditionId(
  startDate: string,
  source: { id: string; start_date: string; merged_into_id?: string | null } | null | undefined,
  identity?: { incoming: DedupEvent; stored: DedupEvent },
): string | undefined {
  if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
  if (source.start_date.slice(0, 4) !== startDate.slice(0, 4)) return undefined;
  // Even an external id may be reassigned to another round in the same year.
  // Renames/reschedules still follow the source unless there is a hard conflict.
  if (identity && hasIdentityConflict(scoreDuplicate(identity.incoming, identity.stored).reasons)) return undefined;
  return source.merged_into_id ?? source.id;
}

/**
 * This source already filed this row, for this very day, but its race now disagrees: most often
 * someone corrected the discipline or country the source gets wrong. A source can file a row only
 * once, so a second race could never be created from it, and that attempt failed on every read.
 * Leave the record as it is rather than fail on every read.
 */
export function settledSourceRow(
  externalId: string,
  startDate: string,
  source: { id: string; start_date: string; merged_into_id?: string | null } | null | undefined,
  matchedId: string | undefined,
): string | undefined {
  if (matchedId || !source) return undefined;
  // A federation can renumber a season's rounds under the same ids, so a day alone does not settle
  // it there; a dated id such as radsport-47-2027-04-10 names its day and must match it.
  const sameYear = source.start_date.slice(0, 4) === startDate.slice(0, 4);
  if (source.start_date !== startDate && !(sameYear && !/\d{4}-\d{2}-\d{2}$/.test(externalId))) return undefined;
  return source.merged_into_id ?? source.id;
}

/** A dated AI calendar row is not evidence that another round moved dates. */
export function calendarRowCandidates<T extends { event: { startDate: string } }>(incomingDate: string, sharedCalendar: boolean, candidates: T[]): T[] {
  return sharedCalendar ? candidates.filter(c => c.event.startDate === incomingDate) : candidates;
}

/** One calendar URL is evidence, never the identity shared by all its rows. */
export function isSharedCalendarEvidence(event: { sourceUrl: string; evidence?: { method: string; sourceUrl: string } }): boolean {
  return ["llm_calendar", "structured_calendar"].includes(event.evidence?.method ?? "") && event.sourceUrl === event.evidence?.sourceUrl;
}
