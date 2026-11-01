import { normalizeName } from "@/lib/domain";

/** Organiser-verified decisions from 2026-11-01; never apply to another edition.
 * Evidence: sudetytour.cz, letapeczech.cz/registrace/krok1/, grizzlyman.cz.
 * Exact aliases deliberately avoid other stages, venues and similarly named races.
 */
export function reviewed2027Identity(event: { name: string; startDate: string; countryHint?: string }) {
  if (!event.startDate.startsWith("2027-") || event.countryHint && event.countryHint.toUpperCase() !== "CZ") return undefined;
  const name = normalizeName(event.name);
  if (/^grizzlyman(?: bike| full| half| teams| duathlon half)?$/.test(name)) {
    return { reject: true as const };
  }
  if (["dekom sudety tour medio fondo", "dekom sudety tour medio fondo rr 85 km"].includes(name)) {
    return { reject: false as const, canonicalId: "a18b06a4-03b7-4b7c-a0f4-ece6a475441f", startDate: "2027-05-09", endDate: "2027-05-09" };
  }
  if (["l etape czech republic hilly stage", "l etape czech republic by tour de france", "kopcovita etapa hilly stage"].includes(name)) {
    return { reject: false as const, canonicalId: "c04842aa-824c-4879-af74-3013d5c47681", startDate: "2027-06-19", endDate: "2027-06-19" };
  }
  return undefined;
}
