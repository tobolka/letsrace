/** UCI prefixes describe a classification, not a different race or annual edition. */
export function raceIdentityName(name: string): string {
  const stripped = name.replace(/^\s*UCI Mountain Bike Continental Series\s*[-–—:]\s*/i, "");
  if (stripped === name) return name;
  const core = stripped.replace(/\s*\+\s*UCI XCO Junior Series\s*$/i, "").trim();
  return core.length >= 4 ? core : name;
}
