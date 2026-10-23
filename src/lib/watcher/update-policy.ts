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
  if (!sources?.some(s => s.kind === "official" || s.kind === "national_federation")) return [];
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
