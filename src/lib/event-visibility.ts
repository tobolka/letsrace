/** Statuses shown on the public map / explore list. */
export const PUBLIC_EVENT_STATUSES = ["scheduled", "tbc", "postponed"] as const;

export type PublicEventStatus = (typeof PUBLIC_EVENT_STATUSES)[number];

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

  return (
    /\bkemp(y|u|ik)?\b/.test(t) ||
    /(^|[^a-z])camps?([^a-z]|$)/.test(t) ||
    /soustreden/.test(t) ||
    /training\s*camp|bike\s*camp|cycling\s*camp|mtb\s*camp|gravel\s*camp|ebike\s*camp/.test(t) ||
    /\bdirectors?\s*meeting\b/.test(t)
  );
}

export function shouldHideFromMap(name: string, status?: string | null): boolean {
  if (status === "hidden" || status === "cancelled") return true;
  return isNonRaceEventName(name);
}
