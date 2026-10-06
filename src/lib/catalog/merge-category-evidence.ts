export type CategoryEvidence = {
  id?: string; name: string; distance_km: number | null; age_min: number | null; age_max: number | null; audience: string | null;
};
const fold = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const fields = ["distance_km", "age_min", "age_max", "audience"] as const;

/** Add missing classes and fill gaps. Conflicting routes/classes remain separate. */
export function mergeCategoryEvidence(existing: CategoryEvidence[], incoming: CategoryEvidence[]) {
  const rows = existing.map(r => ({ ...r }));
  for (const next of incoming) {
    const candidates = rows.filter(r => fold(r.name) === fold(next.name)
      && fields.every(f => r[f] == null || next[f] == null || r[f] === next[f]));
    // A partial class must not assign an age to an arbitrary one of two
    // conflicting distances. Keep that evidence separately until resolved.
    const row = candidates.find(r => fields.every(f => r[f] === next[f]))
      ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (row) {
      for (const f of fields) if (row[f] == null && next[f] != null) Object.assign(row, { [f]: next[f] });
    } else rows.push({ ...next });
  }
  return rows;
}

/** Positive stated evidence is cumulative; guesses cannot widen stated classes. */
export function mergeStatedAges(existing: string[] | null | undefined, existingConfidence: string | null | undefined, stated: string[] | null, inferred: string[]) {
  const known = existingConfidence === "explicit" && Boolean(existing?.length);
  if (stated?.length) return [...new Set([...(known ? existing! : []), ...stated])];
  return existing?.length ? existing : [...new Set(inferred)];
}
