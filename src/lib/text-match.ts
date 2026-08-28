/**
 * Unicode-safe text matching for the classifier.
 *
 * JavaScript's `\b` is ASCII-only, so `/\bsp\b/` matches inside "Spätsommercross"
 * and "späť" — the accented letter reads as a non-word character and opens a
 * boundary. Every abbreviation regex in the taxonomy (SP, MS, ME, WC, ČP) was
 * exposed to that, which is how a German club cross and a Slovak family ride
 * both ended up classified as UCI World Cups. Fold to ASCII first and the
 * boundary means what it looks like it means.
 */

/** Lowercase + strip combining marks. "Špičák" → "spicak", "späť" → "spat". */
export function fold(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .replace(/[ß]/g, "ss")
    .toLowerCase();
}

/** Fold and collapse punctuation to single spaces — for whole-token scanning. */
export function foldTokens(text: string | null | undefined): string {
  return ` ${fold(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/**
 * True when `token` appears as a standalone word in `text`.
 *
 * Runs on {@link foldTokens}, so it never fires on a fragment of a longer
 * accented word. Use this for every short abbreviation (2–3 letters) where a
 * substring hit would be a lie rather than a near miss.
 */
export function hasToken(text: string | null | undefined, token: string): boolean {
  return foldTokens(text).includes(` ${fold(token)} `);
}

/** True when any of `tokens` appears as a standalone word. */
export function hasAnyToken(text: string | null | undefined, tokens: readonly string[]): boolean {
  const blob = foldTokens(text);
  return tokens.some((t) => blob.includes(` ${fold(t)} `));
}

/**
 * True when `token` is directly followed by one of `next` — "ms mtb", "sp xco".
 * Lets an ambiguous abbreviation earn its meaning from the word beside it
 * instead of from the whole page blob.
 */
export function hasTokenFollowedBy(
  text: string | null | undefined,
  token: string,
  next: readonly string[],
): boolean {
  const blob = foldTokens(text);
  return next.some((n) => blob.includes(` ${fold(token)} ${fold(n)} `));
}
