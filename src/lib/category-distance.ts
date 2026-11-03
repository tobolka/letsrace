/** A route must have a positive, finite length; zero means unavailable. */
export function positiveCategoryDistance(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** A source's empty distance is not a named route or an age category. */
export function isDistancePlaceholder(name: string): boolean {
  return /^\s*0(?:[.,]0+)?\s*(?:km|kilomet(?:er|re)s?)\s*$/i.test(name);
}
