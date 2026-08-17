/** Statuses shown on the public map / explore list. */
export const PUBLIC_EVENT_STATUSES = ["scheduled", "tbc", "postponed", "registration_open"] as const;

/**
 * Home map: keep listing even without an official enter link.
 * Everywhere else (especially thin federation dumps like Italy/FCI) needs a website
 * or registration URL so unverified pins don't starve the weekend view.
 */
export const HOME_MAP_COUNTRIES = ["CZ", "SK", "AT", "DE", "PL", "CH"] as const;

export function isHomeMapCountry(code: string | null | undefined): boolean {
  return Boolean(code && (HOME_MAP_COUNTRIES as readonly string[]).includes(code.toUpperCase()));
}

export function isPublicMapWorthy(event: {
  websiteUrl?: string | null;
  registrationUrl?: string | null;
  location?: { countryCode?: string | null } | null;
}): boolean {
  if (isHomeMapCountry(event.location?.countryCode)) return true;
  return Boolean(event.websiteUrl?.trim() || event.registrationUrl?.trim());
}

export type PublicEventStatus = (typeof PUBLIC_EVENT_STATUSES)[number];

export const PUBLIC_VISIBILITY = "public" as const;

/**
 * Camps / training camps — not races.
 * Avoids Italian/Spanish "campionato/campeonato" (championship) false positives.
 */
export function isNonRaceEventName(name: string): boolean {
  const t = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Place / championship false positives
  if (/campionat|campeonato|campione|campus\b|campania|campos\b/.test(t)) return false;

  if (isJunkListingName(name)) return true;

  return (
    /\bkemp(y|u|ik)?\b/.test(t) ||
    /(^|[^a-z])camps?([^a-z]|$)/.test(t) ||
    /soustreden/.test(t) ||
    /training\s*camp|bike\s*camp|cycling\s*camp|mtb\s*camp|gravel\s*camp|ebike\s*camp/.test(t) ||
    /\bdirectors?\s*meeting\b/.test(t)
  );
}

/** Page titles that are calendars/hubs, not a race. */
export function isJunkListingName(name: string): boolean {
  const t = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (t.length < 3) return true;
  return /^(kalendar|calendar|terminovka|termine|rennkalender|race calendar|zavody|races|events|home|uvod|unknown|o zavode|hynek musil)$/.test(
    t,
  );
}

export function shouldHideFromMap(
  name: string,
  status?: string | null,
  visibility?: string | null,
): boolean {
  if (visibility === "hidden") return true;
  if (status === "hidden" || status === "cancelled") return true;
  return isNonRaceEventName(name);
}

