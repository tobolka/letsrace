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
