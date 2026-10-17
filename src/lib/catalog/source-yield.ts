export type StoredEdition = {
  externalId: string | null; start_date: string; end_date?: string | null;
  visibility: string; merged_into_id: string | null;
};

/** A source's Sunday round may already belong to a public Saturday–Sunday edition. */
export function sourceEditionIsRepresented(stored: StoredEdition[], externalId: string, date: string): boolean {
  return sourceEditionExists(stored.filter(e => e.visibility === "public" && !e.merged_into_id), externalId, date);
}

/** Existing hidden/merged records need review, rather than another blind import. */
export function sourceEditionExists(stored: StoredEdition[], externalId: string, date: string): boolean {
  return stored.some(e => e.externalId === externalId && e.start_date <= date && date <= (e.end_date ?? e.start_date));
}
