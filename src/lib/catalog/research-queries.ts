import { searchableName, searchQuery } from "@/lib/catalog/web-finder";

const TERMS: Record<string, [string, string]> = {
  CZ: ["propozice", "přihlášky"], SK: ["propozície", "prihlášky"],
  DE: ["Ausschreibung", "Anmeldung"], AT: ["Ausschreibung", "Anmeldung"],
  CH: ["Reglement", "Anmeldung"], PL: ["regulamin", "zapisy"],
  IT: ["regolamento", "iscrizioni"], FR: ["règlement", "inscription"],
  BE: ["reglement", "inschrijving"], NL: ["reglement", "inschrijving"],
  ES: ["reglamento", "inscripción"],
};

/** Separate searches for missing fields; a known organiser's domain is the best lead. */
export function researchQueries(t: {
  name: string; municipality: string | null; startDate: string; country: string | null;
  website: string | null; registration: string | null; regulations: string | null;
}): string[] {
  const base = searchQuery(t.name, t.municipality, t.startDate.slice(0, 4));
  const [rules, entry] = TERMS[t.country ?? ""] ?? ["regulations", "registration"];
  let scope = "";
  try { if (t.website) scope = ` site:${new URL(t.website).hostname}`; } catch { /* search without a domain */ }
  const queries: string[] = [];
  if (!t.website) queries.push(base);
  if (!t.regulations) queries.push(`${base} ${rules}${scope}`);
  if (!t.registration) queries.push(`${base} ${entry}`);
  // Race homepages often omit the edition's year. The page auditor still checks the edition.
  if (!t.website) queries.push(`${searchableName(t.name)} ${t.municipality ?? ""}`.trim());
  return [...new Set(queries)].slice(0, 4);
}
