import type { ParsedEvent } from "@/lib/domain";
import { countryCodeFromName } from "@/lib/geo/europe";
import { isSiteIdentityName } from "@/lib/watcher/extractors/generic";

/** Extraction and eligibility for the CZ pilot are deliberately separate. */
export function assessCandidate(event: ParsedEvent, targetCountry = "CZ") {
  const issues: string[] = [];
  const place = event.placeText.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const foreignPlace = /\b(belgie|belgium|nemecko|germany|francie|france|spanelsko|spain|nizozemsko|netherlands|italie|italy|slovensko|slovakia|svycarsko|switzerland|rakousko|austria|polsko|poland)\b|\(niz\.\)/.test(place);
  const country = countryCodeFromName(event.placeText) ?? countryCodeFromName(event.name) ?? event.countryHint;
  if ((targetCountry === "CZ" && foreignPlace) || country && country !== targetCountry) issues.push("outside_target_country");
  const name = event.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(hokej\w*|fotbal\w*|tenis\w*|biatlon\w*|olympijske hry)\b/.test(name) && !/cyklo|bike|mtb/.test(name)) issues.push("other_sport");
  if (isSiteIdentityName(event.name) || /^(zavody archiv|v[ií]tejte\b|silnicni zavody pro amatery)/.test(name)) issues.push("generic_name");
  if (!event.evidence?.quote) issues.push("missing_row_evidence");
  if (!country) issues.push("country_needs_verification");
  const tentative = /pripravuje|pripravujeme/.test(name) || /predbez|provisional|tentative|\btbc\b|upresn|termin[^.\n]{0,35}(?:pripravuje|pripravujeme)/.test(name + " " + (event.evidence?.quote ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
  if (tentative) issues.push("tentative_date");
  return { state: issues.some(i => ["outside_target_country", "other_sport", "generic_name"].includes(i)) ? "out_of_scope" as const : "needs_review" as const,
    dateStatus: tentative ? "tentative" as const : "requires_verification" as const, issues };
}
