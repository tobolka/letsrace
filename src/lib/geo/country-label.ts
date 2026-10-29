import { EUROPE_COUNTRY_CODES } from "@/lib/geo/europe";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const labels = new Map<string, string>([["czech republic", "CZ"], ["uk", "GB"], ["great britain", "GB"]]);
for (const code of EUROPE_COUNTRY_CODES) {
  labels.set(code.toLowerCase(), code);
  for (const locale of ["en", "cs", "sk", "de", "pl", "it", "fr"]) {
    labels.set(fold(new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code), code);
  }
}

/** Exact country assertions only; never scan footers or match a town substring. */
export function countryFromLabel(value: string | null | undefined): string | undefined {
  return labels.get(fold(value ?? ""));
}

/** A federation's country is not the venue's when the row explicitly says (DE). */
export function countryFromVenue(value: string | null | undefined): string | undefined {
  const code = value?.match(/[([]\s*([A-Z]{2})\s*[)\]]/)?.[1];
  return code ? countryFromLabel(code) : undefined;
}
