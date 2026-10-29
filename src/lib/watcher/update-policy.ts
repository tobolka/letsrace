/** A broad calendar may fill gaps but cannot replace an official source's
 * identity/date/location fields. Alternative assertions remain in source evidence.
 */
export function protectOfficialFields(
  incomingKind: string | undefined,
  stored: Record<string, unknown> | null,
  proposed: Record<string, unknown>,
): string[] {
  if (!stored || incomingKind !== "aggregator") return [];
  const sources = stored.sources as { kind?: string | null }[] | undefined;
  if (!sources?.some(s => ["official", "national_federation", "series"].includes(s.kind ?? ""))) return [];
  const protectedFields: string[] = [];
  for (const field of ["name", "start_date", "end_date", "location_id", "disciplines", "event_type", "status", "level", "uci_class", "class_label"]) {
    const held = stored[field];
    if (held == null || held === "" || Array.isArray(held) && !held.length || !(field in proposed)) continue;
    if (JSON.stringify(held) === JSON.stringify(proposed[field])) continue;
    proposed[field] = held;
    protectedFields.push(field);
  }
  // The lookup key must continue to describe the values actually stored.
  if (protectedFields.some(f => ["name", "start_date", "location_id"].includes(f))) {
    if (stored.fingerprint) proposed.fingerprint = stored.fingerprint;
    if (stored.name_normalized) proposed.name_normalized = stored.name_normalized;
    if (stored.season) proposed.season = stored.season;
  }
  return protectedFields;
}

/** Missing/general assertions cannot erase specific facts, even in a federation list. */
export function protectSpecificFacts(stored: Record<string, unknown> | null, proposed: Record<string, unknown>): string[] {
  if (!stored) return [];
  const kept: string[] = [];
  const keep = (field: string) => { proposed[field] = stored[field]; kept.push(field); };
  for (const field of ["class_label", "uci_class", "formats", "competition_type"]) {
    const old = stored[field], next = proposed[field];
    if (!(field in proposed) || old == null || old === "" || old === "other" || old === "Local" || old === "community" || Array.isArray(old) && !old.length) continue;
    if (next == null || next === "" || next === "other" || Array.isArray(next) && !next.length) keep(field);
  }
  const old = stored.disciplines, next = proposed.disciplines;
  if (Array.isArray(old) && old.length && Array.isArray(next)) {
    const families: Record<string, string[]> = { mtb: ["xco", "xcc", "xcm", "dh", "enduro", "four_cross"], road: ["tt", "criterium", "hill_climb", "stage_race"] };
    if (!next.length || next.every(d => old.includes(d) || families[d]?.some(specific => old.includes(specific)))) keep("disciplines");
  }
  return kept;
}
